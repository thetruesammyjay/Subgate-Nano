// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20TransferFrom {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface ISubgateStreamRegistry {
    enum PricingModel { PayPerView, MeteredPerMinute }

    struct Stream {
        address creator;
        PricingModel pricingModel;
        uint128 priceAtomic;
        uint32 freePreviewSeconds;
        bool active;
        uint64 createdAt;
        uint64 updatedAt;
    }

    function streamExists(bytes32 streamId) external view returns (bool);
    function getStream(bytes32 streamId) external view returns (Stream memory);
}

/// @title SubgateReceipts
/// @notice Atomic USDC pay-per-view settlement and immutable viewing receipts.
/// @dev A pay-per-view call transfers USDC and records its receipt in one transaction.
///      The operator-only function remains for future off-chain metered settlements.
contract SubgateReceipts {
    struct ViewingReceipt {
        bytes32 streamId;
        address viewer;
        address paymentToken;
        uint64 durationSeconds;
        uint128 amountAtomic;
        uint64 settledAt;
    }

    error Unauthorized(address caller);
    error ZeroAddress();
    error ZeroSessionId();
    error UnknownStream(bytes32 streamId);
    error InactiveStream(bytes32 streamId);
    error NotPayPerView(bytes32 streamId);
    error ReceiptAlreadyExists(bytes32 sessionId);
    error ReceiptNotFound(bytes32 sessionId);
    error InvalidViewer();
    error InvalidAmount();
    error PriceChanged(uint128 expectedAmountAtomic, uint128 registeredAmountAtomic);
    error PaymentTransferFailed();

    address public owner;
    address public settlementOperator;
    ISubgateStreamRegistry public immutable streamRegistry;
    IERC20TransferFrom public immutable paymentToken;
    mapping(bytes32 sessionId => ViewingReceipt receipt) private _receipts;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SettlementOperatorUpdated(address indexed previousOperator, address indexed newOperator);
    event ViewingSessionSettled(
        bytes32 indexed sessionId,
        bytes32 indexed streamId,
        address indexed viewer,
        address paymentToken,
        uint64 durationSeconds,
        uint128 amountAtomic
    );

    constructor(address streamRegistry_, address settlementOperator_, address paymentToken_) {
        if (streamRegistry_ == address(0) || settlementOperator_ == address(0) || paymentToken_ == address(0)) {
            revert ZeroAddress();
        }
        owner = msg.sender;
        streamRegistry = ISubgateStreamRegistry(streamRegistry_);
        settlementOperator = settlementOperator_;
        paymentToken = IERC20TransferFrom(paymentToken_);
        emit OwnershipTransferred(address(0), msg.sender);
        emit SettlementOperatorUpdated(address(0), settlementOperator_);
    }

    /// @notice Charge the registered stream price and write its receipt atomically.
    /// @dev The viewer must first approve this contract to spend the exact USDC amount.
    function settlePayPerView(bytes32 sessionId, bytes32 streamId, uint128 expectedAmountAtomic) external {
        if (sessionId == bytes32(0)) revert ZeroSessionId();
        if (_receipts[sessionId].settledAt != 0) revert ReceiptAlreadyExists(sessionId);
        if (!streamRegistry.streamExists(streamId)) revert UnknownStream(streamId);

        ISubgateStreamRegistry.Stream memory stream = streamRegistry.getStream(streamId);
        if (!stream.active) revert InactiveStream(streamId);
        if (stream.pricingModel != ISubgateStreamRegistry.PricingModel.PayPerView) revert NotPayPerView(streamId);
        if (stream.priceAtomic == 0) revert InvalidAmount();
        if (stream.priceAtomic != expectedAmountAtomic) {
            revert PriceChanged(expectedAmountAtomic, stream.priceAtomic);
        }
        if (!paymentToken.transferFrom(msg.sender, stream.creator, stream.priceAtomic)) revert PaymentTransferFailed();

        // Access is granted before playback; the initial on-chain receipt reports zero watch time.
        _writeReceipt(sessionId, streamId, msg.sender, address(paymentToken), 0, stream.priceAtomic);
    }

    /// @notice Record a metered settlement after an off-chain payment has completed.
    /// @dev This operator path is not used for pay-per-view. `paymentToken` is zero to
    ///      make clear that the receipt alone does not attest to an on-chain transfer.
    function recordSettlement(bytes32 sessionId, bytes32 streamId, address viewer, uint64 durationSeconds, uint128 amountAtomic) external onlySettlementOperator {
        if (sessionId == bytes32(0)) revert ZeroSessionId();
        if (!streamRegistry.streamExists(streamId)) revert UnknownStream(streamId);
        if (_receipts[sessionId].settledAt != 0) revert ReceiptAlreadyExists(sessionId);
        if (viewer == address(0)) revert InvalidViewer();
        if (amountAtomic == 0) revert InvalidAmount();

        _writeReceipt(sessionId, streamId, viewer, address(0), durationSeconds, amountAtomic);
    }

    function getReceipt(bytes32 sessionId) external view returns (ViewingReceipt memory) {
        ViewingReceipt memory receipt = _receipts[sessionId];
        if (receipt.settledAt == 0) revert ReceiptNotFound(sessionId);
        return receipt;
    }

    function receiptExists(bytes32 sessionId) external view returns (bool) {
        return _receipts[sessionId].settledAt != 0;
    }

    function setSettlementOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) revert ZeroAddress();
        address previousOperator = settlementOperator;
        settlementOperator = newOperator;
        emit SettlementOperatorUpdated(previousOperator, newOperator);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function _writeReceipt(bytes32 sessionId, bytes32 streamId, address viewer, address token, uint64 durationSeconds, uint128 amountAtomic) private {
        _receipts[sessionId] = ViewingReceipt(streamId, viewer, token, durationSeconds, amountAtomic, uint64(block.timestamp));
        emit ViewingSessionSettled(sessionId, streamId, viewer, token, durationSeconds, amountAtomic);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized(msg.sender);
        _;
    }

    modifier onlySettlementOperator() {
        if (msg.sender != settlementOperator) revert Unauthorized(msg.sender);
        _;
    }
}
