// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISubgateStreamRegistry {
    function streamExists(bytes32 streamId) external view returns (bool);
}

/// @title SubgateReceipts
/// @notice Immutable, verifiable settlement receipts for completed viewing sessions.
/// @dev This records settlement facts; USDC transfer execution is handled by the settlement adapter.
contract SubgateReceipts {
    struct ViewingReceipt {
        bytes32 streamId;
        address viewer;
        uint64 durationSeconds;
        uint128 amountAtomic;
        uint64 settledAt;
    }

    error Unauthorized(address caller);
    error ZeroAddress();
    error ZeroSessionId();
    error UnknownStream(bytes32 streamId);
    error ReceiptAlreadyExists(bytes32 sessionId);
    error ReceiptNotFound(bytes32 sessionId);
    error InvalidViewer();
    error InvalidAmount();

    address public owner;
    address public settlementOperator;
    ISubgateStreamRegistry public immutable streamRegistry;
    mapping(bytes32 sessionId => ViewingReceipt receipt) private _receipts;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SettlementOperatorUpdated(address indexed previousOperator, address indexed newOperator);
    event ViewingSessionSettled(bytes32 indexed sessionId, bytes32 indexed streamId, address indexed viewer, uint64 durationSeconds, uint128 amountAtomic);

    constructor(ISubgateStreamRegistry streamRegistry_, address settlementOperator_) {
        if (address(streamRegistry_) == address(0) || settlementOperator_ == address(0)) revert ZeroAddress();
        owner = msg.sender;
        streamRegistry = streamRegistry_;
        settlementOperator = settlementOperator_;
        emit OwnershipTransferred(address(0), msg.sender);
        emit SettlementOperatorUpdated(address(0), settlementOperator_);
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

    function recordSettlement(bytes32 sessionId, bytes32 streamId, address viewer, uint64 durationSeconds, uint128 amountAtomic) external onlySettlementOperator {
        if (sessionId == bytes32(0)) revert ZeroSessionId();
        if (!streamRegistry.streamExists(streamId)) revert UnknownStream(streamId);
        if (_receipts[sessionId].settledAt != 0) revert ReceiptAlreadyExists(sessionId);
        if (viewer == address(0)) revert InvalidViewer();
        if (amountAtomic == 0) revert InvalidAmount();

        _receipts[sessionId] = ViewingReceipt(streamId, viewer, durationSeconds, amountAtomic, uint64(block.timestamp));
        emit ViewingSessionSettled(sessionId, streamId, viewer, durationSeconds, amountAtomic);
    }

    function getReceipt(bytes32 sessionId) external view returns (ViewingReceipt memory) {
        ViewingReceipt memory receipt = _receipts[sessionId];
        if (receipt.settledAt == 0) revert ReceiptNotFound(sessionId);
        return receipt;
    }

    function receiptExists(bytes32 sessionId) external view returns (bool) {
        return _receipts[sessionId].settledAt != 0;
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
