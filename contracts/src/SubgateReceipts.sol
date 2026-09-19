// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SubgateReceipts {
    event ViewingSessionSettled(bytes32 indexed sessionId, uint256 durationSeconds, uint256 amount);
    function recordSettlement(bytes32 sessionId, uint256 durationSeconds, uint256 amount) external {
        emit ViewingSessionSettled(sessionId, durationSeconds, amount);
    }
}
