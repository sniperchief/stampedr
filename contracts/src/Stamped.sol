// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Stamped
/// @notice Tamper-proof, timestamped proof-of-delivery receipts. Stores only a
///         SHA-256 fingerprint of delivered content plus metadata — never the
///         content itself.
contract Stamped {
    struct Receipt {
        bytes32 fileHash;
        address creator;
        string clientName;
        string description;
        uint256 dueDate;
        uint256 createdAt;
        bool paid;
    }

    error InvalidDueDate();
    error DuplicateFileHash();
    error ReceiptNotFound();
    error NotReceiptCreator();
    error AlreadyPaid();
    error EmptyClientName();

    event ReceiptCreated(
        uint256 indexed receiptId,
        address indexed creator,
        bytes32 fileHash,
        uint256 createdAt
    );
    event ReceiptPaid(uint256 indexed receiptId);

    uint256 private _nextReceiptId = 1;

    mapping(uint256 => Receipt) private _receipts;
    mapping(address => uint256[]) private _receiptsByCreator;
    mapping(bytes32 => bool) private _fileHashUsed;

    /// @notice Creates a new receipt, locking `fileHash` and the current
    ///         block timestamp on-chain permanently.
    /// @param fileHash SHA-256 fingerprint of the delivered file/content.
    /// @param clientName Plain-text label for the client.
    /// @param description Short label describing what was delivered.
    /// @param dueDate Unix timestamp the delivery was due, or 0 if not applicable.
    function createReceipt(
        bytes32 fileHash,
        string calldata clientName,
        string calldata description,
        uint256 dueDate
    ) external returns (uint256 receiptId) {
        if (bytes(clientName).length == 0) revert EmptyClientName();
        if (dueDate != 0 && dueDate < block.timestamp) revert InvalidDueDate();
        if (_fileHashUsed[fileHash]) revert DuplicateFileHash();

        receiptId = _nextReceiptId++;

        _receipts[receiptId] = Receipt({
            fileHash: fileHash,
            creator: msg.sender,
            clientName: clientName,
            description: description,
            dueDate: dueDate,
            createdAt: block.timestamp,
            paid: false
        });
        _fileHashUsed[fileHash] = true;
        _receiptsByCreator[msg.sender].push(receiptId);

        emit ReceiptCreated(receiptId, msg.sender, fileHash, block.timestamp);
    }

    /// @notice Marks a receipt as paid. Only callable by the receipt's creator.
    function markPaid(uint256 receiptId) external {
        Receipt storage receipt = _receipts[receiptId];
        if (receipt.creator == address(0)) revert ReceiptNotFound();
        if (receipt.creator != msg.sender) revert NotReceiptCreator();
        if (receipt.paid) revert AlreadyPaid();

        receipt.paid = true;
        emit ReceiptPaid(receiptId);
    }

    /// @notice Returns the full receipt struct for a given id.
    function getReceipt(uint256 receiptId) external view returns (Receipt memory) {
        Receipt memory receipt = _receipts[receiptId];
        if (receipt.creator == address(0)) revert ReceiptNotFound();
        return receipt;
    }

    /// @notice Returns all receipt ids created by `creator`.
    function getReceiptsByCreator(address creator) external view returns (uint256[] memory) {
        return _receiptsByCreator[creator];
    }
}
