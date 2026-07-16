// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Stamped} from "../src/Stamped.sol";

contract StampedTest is Test {
    Stamped internal stamped;

    address internal freelancer = makeAddr("freelancer");
    address internal otherFreelancer = makeAddr("otherFreelancer");
    address internal randomCaller = makeAddr("randomCaller");

    bytes32 internal constant HASH_A = keccak256("file-a");
    bytes32 internal constant HASH_B = keccak256("file-b");

    function setUp() public {
        stamped = new Stamped();
        vm.warp(1_800_000_000);
    }

    function _createDefault(address creator, bytes32 fileHash) internal returns (uint256) {
        vm.prank(creator);
        return stamped.createReceipt(fileHash, "Acme Corp", "Homepage draft v2", 0);
    }

    // --- createReceipt ---

    function test_createReceipt_storesFieldsAndEmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit Stamped.ReceiptCreated(1, freelancer, HASH_A, block.timestamp);

        vm.prank(freelancer);
        uint256 id = stamped.createReceipt(HASH_A, "Acme Corp", "Homepage draft v2", 0);

        assertEq(id, 1);

        Stamped.Receipt memory r = stamped.getReceipt(id);
        assertEq(r.fileHash, HASH_A);
        assertEq(r.creator, freelancer);
        assertEq(r.clientName, "Acme Corp");
        assertEq(r.description, "Homepage draft v2");
        assertEq(r.dueDate, 0);
        assertEq(r.createdAt, block.timestamp);
        assertFalse(r.paid);
    }

    function test_createReceipt_incrementsIdsAcrossCreators() public {
        uint256 id1 = _createDefault(freelancer, HASH_A);
        uint256 id2 = _createDefault(otherFreelancer, HASH_B);
        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    function test_createReceipt_acceptsFutureDueDate() public {
        uint256 futureDate = block.timestamp + 7 days;
        vm.prank(freelancer);
        uint256 id = stamped.createReceipt(HASH_A, "Acme Corp", "desc", futureDate);
        assertEq(stamped.getReceipt(id).dueDate, futureDate);
    }

    function test_createReceipt_revertsOnPastDueDate() public {
        vm.warp(2_000_000_000);
        uint256 pastDate = block.timestamp - 1;

        vm.expectRevert(Stamped.InvalidDueDate.selector);
        vm.prank(freelancer);
        stamped.createReceipt(HASH_A, "Acme Corp", "desc", pastDate);
    }

    function test_createReceipt_revertsOnEmptyClientName() public {
        vm.expectRevert(Stamped.EmptyClientName.selector);
        vm.prank(freelancer);
        stamped.createReceipt(HASH_A, "", "desc", 0);
    }

    function test_createReceipt_revertsOnDuplicateFileHash() public {
        _createDefault(freelancer, HASH_A);

        vm.expectRevert(Stamped.DuplicateFileHash.selector);
        vm.prank(otherFreelancer);
        stamped.createReceipt(HASH_A, "Different Client", "different desc", 0);
    }

    function test_createReceipt_allowsDifferentHashesFromSameCreator() public {
        uint256 id1 = _createDefault(freelancer, HASH_A);
        uint256 id2 = _createDefault(freelancer, HASH_B);
        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    // --- markPaid ---

    function test_markPaid_byCreatorSucceeds() public {
        uint256 id = _createDefault(freelancer, HASH_A);

        vm.expectEmit(true, false, false, false);
        emit Stamped.ReceiptPaid(id);

        vm.prank(freelancer);
        stamped.markPaid(id);

        assertTrue(stamped.getReceipt(id).paid);
    }

    function test_markPaid_revertsForNonCreator() public {
        uint256 id = _createDefault(freelancer, HASH_A);

        vm.expectRevert(Stamped.NotReceiptCreator.selector);
        vm.prank(randomCaller);
        stamped.markPaid(id);
    }

    function test_markPaid_revertsForOtherFreelancer() public {
        uint256 id = _createDefault(freelancer, HASH_A);

        vm.expectRevert(Stamped.NotReceiptCreator.selector);
        vm.prank(otherFreelancer);
        stamped.markPaid(id);
    }

    function test_markPaid_revertsIfAlreadyPaid() public {
        uint256 id = _createDefault(freelancer, HASH_A);

        vm.prank(freelancer);
        stamped.markPaid(id);

        vm.expectRevert(Stamped.AlreadyPaid.selector);
        vm.prank(freelancer);
        stamped.markPaid(id);
    }

    function test_markPaid_revertsForNonexistentReceipt() public {
        vm.expectRevert(Stamped.ReceiptNotFound.selector);
        vm.prank(freelancer);
        stamped.markPaid(999);
    }

    // --- getReceipt ---

    function test_getReceipt_revertsForNonexistentReceipt() public {
        vm.expectRevert(Stamped.ReceiptNotFound.selector);
        stamped.getReceipt(999);
    }

    // --- getReceiptsByCreator ---

    function test_getReceiptsByCreator_returnsOnlyThatCreatorsReceipts() public {
        uint256 id1 = _createDefault(freelancer, HASH_A);
        uint256 id2 = _createDefault(otherFreelancer, HASH_B);

        uint256[] memory freelancerReceipts = stamped.getReceiptsByCreator(freelancer);
        uint256[] memory otherReceipts = stamped.getReceiptsByCreator(otherFreelancer);

        assertEq(freelancerReceipts.length, 1);
        assertEq(freelancerReceipts[0], id1);
        assertEq(otherReceipts.length, 1);
        assertEq(otherReceipts[0], id2);
    }

    function test_getReceiptsByCreator_emptyForUnknownAddress() public view {
        uint256[] memory receipts = stamped.getReceiptsByCreator(randomCaller);
        assertEq(receipts.length, 0);
    }
}
