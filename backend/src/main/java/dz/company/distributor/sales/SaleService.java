package dz.company.distributor.sales;

import dz.company.distributor.audit.AuditService;
import dz.company.distributor.common.exception.BusinessException;
import dz.company.distributor.common.exception.ResourceNotFoundException;
import dz.company.distributor.inventory.InventoryService;
import dz.company.distributor.inventory.StockMovementType;
import dz.company.distributor.products.Product;
import dz.company.distributor.products.ProductRepository;
import dz.company.distributor.sales.dto.*;
import dz.company.distributor.security.SecurityUtils;
import dz.company.distributor.users.User;
import dz.company.distributor.warehouses.Warehouse;
import dz.company.distributor.warehouses.WarehouseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SaleService {

    private final SaleRepository saleRepository;
    private final SaleItemRepository saleItemRepository;
    private final WarehouseRepository warehouseRepository;
    private final ProductRepository productRepository;
    private final InventoryService inventoryService;
    private final AuditService auditService;

    public SaleService(
            SaleRepository saleRepository,
            SaleItemRepository saleItemRepository,
            WarehouseRepository warehouseRepository,
            ProductRepository productRepository,
            InventoryService inventoryService,
            AuditService auditService
    ) {
        this.saleRepository = saleRepository;
        this.saleItemRepository = saleItemRepository;
        this.warehouseRepository = warehouseRepository;
        this.productRepository = productRepository;
        this.inventoryService = inventoryService;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<SaleDto> getSales(Long warehouseId) {
        if (warehouseId != null && !SecurityUtils.isAdmin() && !SecurityUtils.isSuperManager()) {
            SecurityUtils.validateWarehouseAccess(warehouseId);
        }
        List<Sale> sales = (warehouseId != null)
                ? saleRepository.findByWarehouseIdOrderBySaleDateDesc(warehouseId)
                : saleRepository.findAllByOrderBySaleDateDesc();
        return sales.stream().map(this::mapToDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public SaleDto getSaleById(Long id) {
        Sale sale = saleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found with id: " + id));
        if (!SecurityUtils.isAdmin() && !SecurityUtils.isSuperManager()) {
            SecurityUtils.validateWarehouseAccess(sale.getWarehouse().getId());
        }
        return mapToDto(sale);
    }

    @Transactional
    public SaleDto createSale(CreateSaleRequest request) {
        SecurityUtils.validateWarehouseAccess(request.getWarehouseId());

        Warehouse warehouse = warehouseRepository.findById(request.getWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found with id: " + request.getWarehouseId()));
        User currentUser = SecurityUtils.getCurrentUser();

        String invoiceNumber = generateInvoiceNumber();

        Sale sale = new Sale(
                warehouse,
                invoiceNumber,
                request.getCustomerName(),
                request.getCustomerPhone(),
                BigDecimal.ZERO,
                LocalDateTime.now(),
                SaleStatus.COMPLETED,
                currentUser
        );
        Sale savedSale = saleRepository.save(sale);

        BigDecimal totalAmount = BigDecimal.ZERO;
        List<SaleItem> items = new ArrayList<>();

        for (SaleItemRequest itemReq : request.getItems()) {
            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + itemReq.getProductId()));

            // 1. Transactionally deduct stock
            inventoryService.deductStock(
                    warehouse.getId(),
                    product.getId(),
                    itemReq.getQuantity(),
                    "SALE",
                    savedSale.getId(),
                    StockMovementType.SALE,
                    "Sale invoice " + invoiceNumber
            );

            // 2. Snapshot unit price and calculate subtotal
            BigDecimal unitPrice = product.getSalePrice();
            BigDecimal subtotal = unitPrice.multiply(BigDecimal.valueOf(itemReq.getQuantity()));
            totalAmount = totalAmount.add(subtotal);

            SaleItem saleItem = new SaleItem(savedSale, product, itemReq.getQuantity(), unitPrice, subtotal);
            items.add(saleItem);
        }

        savedSale.setItems(items);
        savedSale.setTotalAmount(totalAmount);
        Sale finalSale = saleRepository.save(savedSale);

        auditService.logAction(
                "SALE_CREATED",
                "SALE",
                finalSale.getId(),
                warehouse,
                null,
                "Invoice: " + invoiceNumber + ", Total: " + totalAmount + " DZD",
                "Created sale for " + (request.getCustomerName() != null ? request.getCustomerName() : "General Customer")
        );

        return mapToDto(finalSale);
    }

    @Transactional
    public SaleDto updateSale(Long saleId, UpdateSaleRequest request) {
        Sale sale = saleRepository.findById(saleId)
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found with id: " + saleId));

        SecurityUtils.validateWarehouseAccess(sale.getWarehouse().getId());

        if (sale.getStatus() == SaleStatus.CANCELLED) {
            throw new BusinessException("Cannot modify a cancelled sale");
        }

        Long warehouseId = sale.getWarehouse().getId();
        BigDecimal oldTotal = sale.getTotalAmount();

        // Build mapping of old items by product ID
        Map<Long, SaleItem> oldItemsByProduct = new HashMap<>();
        for (SaleItem item : sale.getItems()) {
            oldItemsByProduct.put(item.getProduct().getId(), item);
        }

        // Process new items and reconcile inventory differences
        Map<Long, Integer> newQuantitiesByProduct = new HashMap<>();
        for (SaleItemRequest itemReq : request.getItems()) {
            newQuantitiesByProduct.put(itemReq.getProductId(), itemReq.getQuantity());
        }

        // 1. Handle items in old that are NOT in new (removed items) -> return all stock
        for (SaleItem oldItem : sale.getItems()) {
            Long pId = oldItem.getProduct().getId();
            if (!newQuantitiesByProduct.containsKey(pId)) {
                inventoryService.addStock(
                        warehouseId,
                        pId,
                        oldItem.getQuantity(),
                        "SALE_EDIT_REMOVE",
                        sale.getId(),
                        StockMovementType.ADJUSTMENT,
                        "Returned stock from removed item in sale " + sale.getInvoiceNumber()
                );
            }
        }

        // 2. Handle items in new (either existing or new)
        List<SaleItem> updatedItems = new ArrayList<>();
        BigDecimal newTotal = BigDecimal.ZERO;

        for (SaleItemRequest itemReq : request.getItems()) {
            Long pId = itemReq.getProductId();
            int newQty = itemReq.getQuantity();

            Product product = productRepository.findById(pId)
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + pId));

            if (oldItemsByProduct.containsKey(pId)) {
                SaleItem existingItem = oldItemsByProduct.get(pId);
                int oldQty = existingItem.getQuantity();
                int delta = newQty - oldQty;

                if (delta > 0) {
                    // Increased quantity -> deduct delta from stock
                    inventoryService.deductStock(
                            warehouseId,
                            pId,
                            delta,
                            "SALE_EDIT_INC",
                            sale.getId(),
                            StockMovementType.SALE,
                            "Increased item quantity in sale " + sale.getInvoiceNumber()
                    );
                } else if (delta < 0) {
                    // Decreased quantity -> return delta to stock
                    inventoryService.addStock(
                            warehouseId,
                            pId,
                            Math.abs(delta),
                            "SALE_EDIT_DEC",
                            sale.getId(),
                            StockMovementType.ADJUSTMENT,
                            "Decreased item quantity in sale " + sale.getInvoiceNumber()
                    );
                }

                existingItem.setQuantity(newQty);
                existingItem.setSubtotal(existingItem.getUnitPrice().multiply(BigDecimal.valueOf(newQty)));
                updatedItems.add(existingItem);
                newTotal = newTotal.add(existingItem.getSubtotal());
            } else {
                // Completely new item added to sale -> deduct full quantity
                inventoryService.deductStock(
                        warehouseId,
                        pId,
                        newQty,
                        "SALE_EDIT_ADD",
                        sale.getId(),
                        StockMovementType.SALE,
                        "Added new item in edited sale " + sale.getInvoiceNumber()
                );

                BigDecimal unitPrice = product.getSalePrice();
                BigDecimal subtotal = unitPrice.multiply(BigDecimal.valueOf(newQty));
                SaleItem newItem = new SaleItem(sale, product, newQty, unitPrice, subtotal);
                updatedItems.add(newItem);
                newTotal = newTotal.add(subtotal);
            }
        }

        sale.getItems().clear();
        sale.getItems().addAll(updatedItems);
        sale.setCustomerName(request.getCustomerName());
        sale.setCustomerPhone(request.getCustomerPhone());
        sale.setTotalAmount(newTotal);

        Sale saved = saleRepository.save(sale);

        auditService.logAction(
                "SALE_EDITED",
                "SALE",
                saved.getId(),
                sale.getWarehouse(),
                "Total: " + oldTotal + " DZD",
                "Total: " + newTotal + " DZD",
                "Modified sale " + sale.getInvoiceNumber() + " with inventory reconciliation"
        );

        return mapToDto(saved);
    }

    @Transactional
    public SaleDto cancelSale(Long saleId) {
        Sale sale = saleRepository.findById(saleId)
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found with id: " + saleId));

        SecurityUtils.validateWarehouseAccess(sale.getWarehouse().getId());

        if (sale.getStatus() == SaleStatus.CANCELLED) {
            throw new BusinessException("Sale is already cancelled");
        }

        // Return stock for all items
        for (SaleItem item : sale.getItems()) {
            inventoryService.addStock(
                    sale.getWarehouse().getId(),
                    item.getProduct().getId(),
                    item.getQuantity(),
                    "SALE_CANCELLED",
                    sale.getId(),
                    StockMovementType.ADJUSTMENT,
                    "Stock returned from cancelled sale " + sale.getInvoiceNumber()
            );
        }

        sale.setStatus(SaleStatus.CANCELLED);
        Sale saved = saleRepository.save(sale);

        auditService.logAction(
                "SALE_CANCELLED",
                "SALE",
                saved.getId(),
                saved.getWarehouse(),
                "Status: COMPLETED",
                "Status: CANCELLED",
                "Cancelled sale " + saved.getInvoiceNumber() + " and restored physical stock"
        );

        return mapToDto(saved);
    }

    private synchronized String generateInvoiceNumber() {
        String datePrefix = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMM"));
        long count = saleRepository.count() + 1;
        return String.format("INV-%s-%04d", datePrefix, count);
    }

    public SaleDto mapToDto(Sale sale) {
        List<SaleItemDto> itemDtos = sale.getItems().stream().map(item -> new SaleItemDto(
                item.getId(),
                item.getProduct().getId(),
                item.getProduct().getReference(),
                item.getProduct().getName(),
                item.getProduct().getBrand(),
                item.getProduct().getUnit(),
                item.getQuantity(),
                item.getUnitPrice(),
                item.getSubtotal()
        )).collect(Collectors.toList());

        return new SaleDto(
                sale.getId(),
                sale.getWarehouse().getId(),
                sale.getWarehouse().getName(),
                sale.getWarehouse().getCode(),
                sale.getInvoiceNumber(),
                sale.getCustomerName(),
                sale.getCustomerPhone(),
                sale.getTotalAmount(),
                sale.getSaleDate(),
                sale.getStatus(),
                sale.getCreatedBy() != null ? sale.getCreatedBy().getId() : null,
                sale.getCreatedBy() != null ? sale.getCreatedBy().getFullName() : "Unknown",
                itemDtos,
                sale.getCreatedAt(),
                sale.getUpdatedAt()
        );
    }
}
