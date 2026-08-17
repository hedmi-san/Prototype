package dz.company.distributor.transfers;

import dz.company.distributor.audit.AuditService;
import dz.company.distributor.common.exception.BusinessException;
import dz.company.distributor.common.exception.ResourceNotFoundException;
import dz.company.distributor.inventory.InventoryService;
import dz.company.distributor.products.Product;
import dz.company.distributor.products.ProductRepository;
import dz.company.distributor.security.SecurityUtils;
import dz.company.distributor.transfers.dto.*;
import dz.company.distributor.users.User;
import dz.company.distributor.warehouses.Warehouse;
import dz.company.distributor.warehouses.WarehouseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class TransferService {

    private final TransferRepository transferRepository;
    private final TransferItemRepository transferItemRepository;
    private final WarehouseRepository warehouseRepository;
    private final ProductRepository productRepository;
    private final InventoryService inventoryService;
    private final AuditService auditService;

    public TransferService(
            TransferRepository transferRepository,
            TransferItemRepository transferItemRepository,
            WarehouseRepository warehouseRepository,
            ProductRepository productRepository,
            InventoryService inventoryService,
            AuditService auditService
    ) {
        this.transferRepository = transferRepository;
        this.transferItemRepository = transferItemRepository;
        this.warehouseRepository = warehouseRepository;
        this.productRepository = productRepository;
        this.inventoryService = inventoryService;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<TransferDto> getTransfers(Long warehouseId) {
        if (warehouseId != null && !SecurityUtils.isAdmin() && !SecurityUtils.isSuperManager()) {
            SecurityUtils.validateWarehouseAccess(warehouseId);
        }
        List<Transfer> transfers = (warehouseId != null)
                ? transferRepository.findByWarehouseInvolved(warehouseId)
                : transferRepository.findAllByOrderByCreatedAtDesc();
        return transfers.stream().map(this::mapToDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public TransferDto getTransferById(Long id) {
        Transfer transfer = transferRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Transfer not found with id: " + id));
        return mapToDto(transfer);
    }

    @Transactional
    public TransferDto createTransfer(CreateTransferRequest request) {
        if (request.getSourceWarehouseId().equals(request.getDestinationWarehouseId())) {
            throw new BusinessException("Source and destination warehouses must be different");
        }

        // Requester must have access to destination warehouse
        SecurityUtils.validateWarehouseAccess(request.getDestinationWarehouseId());

        Warehouse sourceWarehouse = warehouseRepository.findById(request.getSourceWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Source warehouse not found: " + request.getSourceWarehouseId()));
        Warehouse destWarehouse = warehouseRepository.findById(request.getDestinationWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Destination warehouse not found: " + request.getDestinationWarehouseId()));
        User currentUser = SecurityUtils.getCurrentUser();

        Transfer transfer = new Transfer(sourceWarehouse, destWarehouse, TransferStatus.REQUESTED, currentUser, request.getNotes());
        Transfer saved = transferRepository.save(transfer);

        List<TransferItem> items = new ArrayList<>();
        for (TransferItemRequest itemReq : request.getItems()) {
            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + itemReq.getProductId()));
            TransferItem item = new TransferItem(saved, product, itemReq.getRequestedQuantity(), 0);
            items.add(item);
        }

        saved.setItems(items);
        Transfer finalTransfer = transferRepository.save(saved);

        auditService.logAction(
                "TRANSFER_REQUESTED",
                "TRANSFER",
                finalTransfer.getId(),
                destWarehouse,
                null,
                "From " + sourceWarehouse.getName() + " to " + destWarehouse.getName(),
                "Created transfer request #" + finalTransfer.getId()
        );

        return mapToDto(finalTransfer);
    }

    @Transactional
    public TransferDto approveTransfer(Long transferId, ApproveTransferRequest request) {
        Transfer transfer = transferRepository.findById(transferId)
                .orElseThrow(() -> new ResourceNotFoundException("Transfer not found with id: " + transferId));

        if (transfer.getStatus() != TransferStatus.REQUESTED) {
            throw new BusinessException("Only transfers in REQUESTED status can be approved. Current: " + transfer.getStatus());
        }

        // Only source warehouse manager or admin can approve
        SecurityUtils.validateWarehouseAccess(transfer.getSourceWarehouse().getId());

        Map<Long, Integer> approvedQuantities = new HashMap<>();
        for (ApprovedItemRequest itemReq : request.getItems()) {
            approvedQuantities.put(itemReq.getProductId(), itemReq.getApprovedQuantity());
        }

        for (TransferItem item : transfer.getItems()) {
            int approvedQty = approvedQuantities.getOrDefault(item.getProduct().getId(), 0);
            if (approvedQty > item.getRequestedQuantity()) {
                throw new BusinessException("Approved quantity cannot exceed requested quantity for product: " + item.getProduct().getName());
            }

            if (approvedQty > 0) {
                // Reserve stock at source warehouse
                inventoryService.reserveStock(transfer.getSourceWarehouse().getId(), item.getProduct().getId(), approvedQty);
            }
            item.setApprovedQuantity(approvedQty);
        }

        transfer.setStatus(TransferStatus.APPROVED);
        transfer.setApprovedAt(LocalDateTime.now());
        Transfer saved = transferRepository.save(transfer);

        auditService.logAction(
                "TRANSFER_APPROVED",
                "TRANSFER",
                saved.getId(),
                transfer.getSourceWarehouse(),
                "Status: REQUESTED",
                "Status: APPROVED",
                "Approved transfer request #" + saved.getId() + " and reserved stock"
        );

        return mapToDto(saved);
    }

    @Transactional
    public TransferDto confirmTransfer(Long transferId) {
        Transfer transfer = transferRepository.findById(transferId)
                .orElseThrow(() -> new ResourceNotFoundException("Transfer not found with id: " + transferId));

        if (transfer.getStatus() != TransferStatus.APPROVED) {
            throw new BusinessException("Only transfers in APPROVED status can be confirmed. Current: " + transfer.getStatus());
        }

        // Destination warehouse manager confirms reception
        SecurityUtils.validateWarehouseAccess(transfer.getDestinationWarehouse().getId());

        Long sourceWarehouseId = transfer.getSourceWarehouse().getId();
        Long destWarehouseId = transfer.getDestinationWarehouse().getId();

        for (TransferItem item : transfer.getItems()) {
            if (item.getApprovedQuantity() > 0) {
                inventoryService.fulfillTransfer(
                        sourceWarehouseId,
                        destWarehouseId,
                        item.getProduct().getId(),
                        item.getApprovedQuantity(),
                        transfer.getId()
                );
            }
        }

        transfer.setStatus(TransferStatus.CONFIRMED);
        transfer.setConfirmedAt(LocalDateTime.now());
        Transfer saved = transferRepository.save(transfer);

        auditService.logAction(
                "TRANSFER_CONFIRMED",
                "TRANSFER",
                saved.getId(),
                transfer.getDestinationWarehouse(),
                "Status: APPROVED",
                "Status: CONFIRMED",
                "Confirmed reception of transfer #" + saved.getId() + " and transferred stock"
        );

        return mapToDto(saved);
    }

    @Transactional
    public TransferDto declineTransfer(Long transferId) {
        Transfer transfer = transferRepository.findById(transferId)
                .orElseThrow(() -> new ResourceNotFoundException("Transfer not found with id: " + transferId));

        SecurityUtils.validateWarehouseAccess(transfer.getSourceWarehouse().getId());

        if (transfer.getStatus() == TransferStatus.CONFIRMED || transfer.getStatus() == TransferStatus.CANCELLED || transfer.getStatus() == TransferStatus.DECLINED) {
            throw new BusinessException("Cannot decline a transfer with status: " + transfer.getStatus());
        }

        // If it was approved, release any reserved stock
        if (transfer.getStatus() == TransferStatus.APPROVED) {
            for (TransferItem item : transfer.getItems()) {
                if (item.getApprovedQuantity() > 0) {
                    inventoryService.releaseReservedStock(
                            transfer.getSourceWarehouse().getId(),
                            item.getProduct().getId(),
                            item.getApprovedQuantity()
                    );
                }
            }
        }

        transfer.setStatus(TransferStatus.DECLINED);
        Transfer saved = transferRepository.save(transfer);

        auditService.logAction(
                "TRANSFER_DECLINED",
                "TRANSFER",
                saved.getId(),
                transfer.getSourceWarehouse(),
                null,
                "Status: DECLINED",
                "Declined transfer request #" + saved.getId()
        );

        return mapToDto(saved);
    }

    @Transactional
    public TransferDto cancelTransfer(Long transferId) {
        Transfer transfer = transferRepository.findById(transferId)
                .orElseThrow(() -> new ResourceNotFoundException("Transfer not found with id: " + transferId));

        // Destination warehouse manager can cancel
        SecurityUtils.validateWarehouseAccess(transfer.getDestinationWarehouse().getId());

        if (transfer.getStatus() == TransferStatus.CONFIRMED) {
            throw new BusinessException("Cannot cancel an already confirmed transfer");
        }

        // If it was approved, release any reserved stock at source
        if (transfer.getStatus() == TransferStatus.APPROVED) {
            for (TransferItem item : transfer.getItems()) {
                if (item.getApprovedQuantity() > 0) {
                    inventoryService.releaseReservedStock(
                            transfer.getSourceWarehouse().getId(),
                            item.getProduct().getId(),
                            item.getApprovedQuantity()
                    );
                }
            }
        }

        transfer.setStatus(TransferStatus.CANCELLED);
        Transfer saved = transferRepository.save(transfer);

        auditService.logAction(
                "TRANSFER_CANCELLED",
                "TRANSFER",
                saved.getId(),
                transfer.getDestinationWarehouse(),
                null,
                "Status: CANCELLED",
                "Cancelled transfer request #" + saved.getId() + " and released reserved stock"
        );

        return mapToDto(saved);
    }

    public TransferDto mapToDto(Transfer transfer) {
        List<TransferItemDto> itemDtos = transfer.getItems().stream().map(item -> new TransferItemDto(
                item.getId(),
                item.getProduct().getId(),
                item.getProduct().getReference(),
                item.getProduct().getName(),
                item.getProduct().getBrand(),
                item.getProduct().getUnit(),
                item.getRequestedQuantity(),
                item.getApprovedQuantity()
        )).collect(Collectors.toList());

        return new TransferDto(
                transfer.getId(),
                transfer.getSourceWarehouse().getId(),
                transfer.getSourceWarehouse().getName(),
                transfer.getSourceWarehouse().getCode(),
                transfer.getDestinationWarehouse().getId(),
                transfer.getDestinationWarehouse().getName(),
                transfer.getDestinationWarehouse().getCode(),
                transfer.getStatus(),
                transfer.getCreatedBy() != null ? transfer.getCreatedBy().getId() : null,
                transfer.getCreatedBy() != null ? transfer.getCreatedBy().getFullName() : "Unknown",
                transfer.getNotes(),
                itemDtos,
                transfer.getCreatedAt(),
                transfer.getApprovedAt(),
                transfer.getConfirmedAt(),
                transfer.getUpdatedAt()
        );
    }
}
