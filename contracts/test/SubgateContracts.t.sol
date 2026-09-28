// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SubgateStreamRegistry} from "../src/SubgateStreamRegistry.sol";
import {SubgateReceipts} from "../src/SubgateReceipts.sol";

contract MockUSDC {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address account, uint256 amount) external {
        balanceOf[account] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "allowance too low");
        require(balanceOf[from] >= amount, "balance too low");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract StreamActor {
    function register(
        SubgateStreamRegistry registry,
        bytes32 streamId,
        SubgateStreamRegistry.PricingModel model,
        uint128 priceAtomic,
        uint32 previewSeconds
    ) external {
        registry.registerStream(streamId, model, priceAtomic, previewSeconds);
    }

    function updatePrice(
        SubgateStreamRegistry registry,
        bytes32 streamId,
        SubgateStreamRegistry.PricingModel model,
        uint128 priceAtomic
    ) external {
        registry.updatePricing(streamId, model, priceAtomic);
    }

    function settle(
        SubgateReceipts receipts,
        bytes32 sessionId,
        bytes32 streamId,
        address viewer,
        uint64 durationSeconds,
        uint128 amountAtomic
    ) external {
        receipts.recordSettlement(sessionId, streamId, viewer, durationSeconds, amountAtomic);
    }
}

/// @dev Uses plain Solidity assertions so the suite has no external test-library dependency.
contract SubgateContractsTest {
    bytes32 private constant STREAM_ID = keccak256("futo-tech-conference");
    bytes32 private constant SESSION_ID = keccak256("session-001");

    function testCreatorRegistersAndUpdatesStream() external {
        SubgateStreamRegistry registry = new SubgateStreamRegistry();
        registry.registerStream(STREAM_ID, SubgateStreamRegistry.PricingModel.MeteredPerMinute, 10_000, 30);

        SubgateStreamRegistry.Stream memory stream = registry.getStream(STREAM_ID);
        require(stream.creator == address(this), "creator was not recorded");
        require(stream.priceAtomic == 10_000, "initial price mismatch");
        require(stream.freePreviewSeconds == 30, "preview mismatch");

        registry.updatePricing(STREAM_ID, SubgateStreamRegistry.PricingModel.PayPerView, 1_500_000);
        stream = registry.getStream(STREAM_ID);
        require(stream.pricingModel == SubgateStreamRegistry.PricingModel.PayPerView, "pricing model mismatch");
        require(stream.priceAtomic == 1_500_000, "updated price mismatch");
    }

    function testOnlyCreatorCanUpdateAStream() external {
        SubgateStreamRegistry registry = new SubgateStreamRegistry();
        StreamActor creator = new StreamActor();
        creator.register(registry, STREAM_ID, SubgateStreamRegistry.PricingModel.PayPerView, 1_000_000, 0);

        bool reverted;
        try registry.updatePricing(STREAM_ID, SubgateStreamRegistry.PricingModel.PayPerView, 2_000_000) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "non-creator updated stream");
    }

    function testSettlementOperatorRecordsOneImmutableReceipt() external {
        SubgateStreamRegistry registry = new SubgateStreamRegistry();
        registry.registerStream(STREAM_ID, SubgateStreamRegistry.PricingModel.MeteredPerMinute, 10_000, 0);
        MockUSDC usdc = new MockUSDC();
        SubgateReceipts receipts = new SubgateReceipts(address(registry), address(this), address(usdc));

        receipts.recordSettlement(SESSION_ID, STREAM_ID, address(0xBEEF), 90, 15_000);
        SubgateReceipts.ViewingReceipt memory receipt = receipts.getReceipt(SESSION_ID);
        require(receipt.streamId == STREAM_ID, "stream mismatch");
        require(receipt.viewer == address(0xBEEF), "viewer mismatch");
        require(receipt.paymentToken == address(0), "operator receipt must not claim on-chain payment");
        require(receipt.durationSeconds == 90, "duration mismatch");
        require(receipt.amountAtomic == 15_000, "amount mismatch");

        bool reverted;
        try receipts.recordSettlement(SESSION_ID, STREAM_ID, address(0xBEEF), 90, 15_000) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "duplicate receipt was recorded");
    }

    function testOnlySettlementOperatorCanRecord() external {
        SubgateStreamRegistry registry = new SubgateStreamRegistry();
        registry.registerStream(STREAM_ID, SubgateStreamRegistry.PricingModel.PayPerView, 1_000_000, 0);
        MockUSDC usdc = new MockUSDC();
        SubgateReceipts receipts = new SubgateReceipts(address(registry), address(this), address(usdc));
        StreamActor caller = new StreamActor();

        bool reverted;
        try caller.settle(receipts, SESSION_ID, STREAM_ID, address(0xBEEF), 0, 1_000_000) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "unauthorized operator recorded receipt");
    }

    function testPayPerViewTransfersUSDCAndRecordsReceiptAtomically() external {
        SubgateStreamRegistry registry = new SubgateStreamRegistry();
        StreamActor creator = new StreamActor();
        creator.register(registry, STREAM_ID, SubgateStreamRegistry.PricingModel.PayPerView, 1_500_000, 30);

        MockUSDC usdc = new MockUSDC();
        SubgateReceipts receipts = new SubgateReceipts(address(registry), address(this), address(usdc));
        usdc.mint(address(this), 2_000_000);
        usdc.approve(address(receipts), 1_500_000);
        receipts.settlePayPerView(SESSION_ID, STREAM_ID, 1_500_000);

        SubgateReceipts.ViewingReceipt memory receipt = receipts.getReceipt(SESSION_ID);
        require(receipt.streamId == STREAM_ID, "stream mismatch");
        require(receipt.viewer == address(this), "viewer mismatch");
        require(receipt.paymentToken == address(usdc), "payment token mismatch");
        require(receipt.durationSeconds == 0, "pre-playback receipt must report zero duration");
        require(receipt.amountAtomic == 1_500_000, "amount mismatch");
        require(usdc.balanceOf(address(creator)) == 1_500_000, "creator was not paid");
        require(usdc.balanceOf(address(this)) == 500_000, "viewer balance mismatch");
    }

    function testPayPerViewRevertsIfRegisteredPriceChanged() external {
        SubgateStreamRegistry registry = new SubgateStreamRegistry();
        registry.registerStream(STREAM_ID, SubgateStreamRegistry.PricingModel.PayPerView, 1_500_000, 0);
        MockUSDC usdc = new MockUSDC();
        SubgateReceipts receipts = new SubgateReceipts(address(registry), address(this), address(usdc));
        usdc.mint(address(this), 2_000_000);
        usdc.approve(address(receipts), 1_500_000);

        registry.updatePricing(STREAM_ID, SubgateStreamRegistry.PricingModel.PayPerView, 2_000_000);
        bool reverted;
        try receipts.settlePayPerView(SESSION_ID, STREAM_ID, 1_500_000) {
            reverted = false;
        } catch {
            reverted = true;
        }

        require(reverted, "settlement ignored the expected price");
        require(usdc.balanceOf(address(this)) == 2_000_000, "viewer was charged after price mismatch");
        require(!receipts.receiptExists(SESSION_ID), "price mismatch wrote a receipt");
    }
}
