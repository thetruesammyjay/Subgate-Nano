// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SubgateStreamRegistry {
    struct Stream { address creator; uint8 pricingModel; uint256 price; bool active; }
    mapping(bytes32 => Stream) public streams;
    event StreamRegistered(bytes32 indexed streamId, address indexed creator, uint8 pricingModel, uint256 price);

    function register(bytes32 streamId, uint8 pricingModel, uint256 price) external {
        streams[streamId] = Stream(msg.sender, pricingModel, price, true);
        emit StreamRegistered(streamId, msg.sender, pricingModel, price);
    }
}
