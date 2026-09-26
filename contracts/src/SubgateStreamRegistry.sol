// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SubgateStreamRegistry
/// @notice Creator-owned stream metadata for Subgate Nano.
/// @dev Prices are USDC atomic units (6 decimals). Playback and metering remain off-chain.
contract SubgateStreamRegistry {
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

    error ZeroStreamId();
    error StreamAlreadyExists(bytes32 streamId);
    error StreamNotFound(bytes32 streamId);
    error Unauthorized(address caller, bytes32 streamId);
    error InvalidPrice();

    mapping(bytes32 streamId => Stream stream) private _streams;

    event StreamRegistered(bytes32 indexed streamId, address indexed creator, PricingModel pricingModel, uint128 priceAtomic, uint32 freePreviewSeconds);
    event StreamPricingUpdated(bytes32 indexed streamId, PricingModel pricingModel, uint128 priceAtomic);
    event StreamPreviewUpdated(bytes32 indexed streamId, uint32 freePreviewSeconds);
    event StreamStatusUpdated(bytes32 indexed streamId, bool active);

    function registerStream(bytes32 streamId, PricingModel pricingModel, uint128 priceAtomic, uint32 freePreviewSeconds) external {
        if (streamId == bytes32(0)) revert ZeroStreamId();
        if (_streams[streamId].creator != address(0)) revert StreamAlreadyExists(streamId);
        if (priceAtomic == 0) revert InvalidPrice();

        uint64 timestamp = uint64(block.timestamp);
        _streams[streamId] = Stream(msg.sender, pricingModel, priceAtomic, freePreviewSeconds, true, timestamp, timestamp);
        emit StreamRegistered(streamId, msg.sender, pricingModel, priceAtomic, freePreviewSeconds);
    }

    function updatePricing(bytes32 streamId, PricingModel pricingModel, uint128 priceAtomic) external onlyCreator(streamId) {
        if (priceAtomic == 0) revert InvalidPrice();
        Stream storage stream = _streams[streamId];
        stream.pricingModel = pricingModel;
        stream.priceAtomic = priceAtomic;
        stream.updatedAt = uint64(block.timestamp);
        emit StreamPricingUpdated(streamId, pricingModel, priceAtomic);
    }

    function updateFreePreview(bytes32 streamId, uint32 freePreviewSeconds) external onlyCreator(streamId) {
        Stream storage stream = _streams[streamId];
        stream.freePreviewSeconds = freePreviewSeconds;
        stream.updatedAt = uint64(block.timestamp);
        emit StreamPreviewUpdated(streamId, freePreviewSeconds);
    }

    function setActive(bytes32 streamId, bool active) external onlyCreator(streamId) {
        Stream storage stream = _streams[streamId];
        stream.active = active;
        stream.updatedAt = uint64(block.timestamp);
        emit StreamStatusUpdated(streamId, active);
    }

    function getStream(bytes32 streamId) external view returns (Stream memory) {
        Stream memory stream = _streams[streamId];
        if (stream.creator == address(0)) revert StreamNotFound(streamId);
        return stream;
    }

    function streamExists(bytes32 streamId) external view returns (bool) {
        return _streams[streamId].creator != address(0);
    }

    modifier onlyCreator(bytes32 streamId) {
        Stream storage stream = _streams[streamId];
        if (stream.creator == address(0)) revert StreamNotFound(streamId);
        if (stream.creator != msg.sender) revert Unauthorized(msg.sender, streamId);
        _;
    }
}
