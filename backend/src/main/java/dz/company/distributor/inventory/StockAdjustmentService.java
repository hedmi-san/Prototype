package dz.company.distributor.inventory;

import dz.company.distributor.audit.AuditService;
import dz.company.distributor.common.exception.BusinessException;
import dz.company.distributor.common.exception.InsufficientStockException;
import dz.company.distributor.common.exception.ResourceNotFoundException;
import dz.company.distributor.inventory.dto.StockAdjustmentRequest;
import dz.company.distributor.inventory.dto.StockDto;
import dz.company.distributor.products.Product;
import dz.company.distributor.products.ProductRepository;
import dz.company.distributor.security.SecurityUtils;
import dz.company.distributor.users.User;
import dz.company.distributor.warehouses.Warehouse;
import dz.company.distributor.warehouses.WarehouseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StockAdjustmentService {

    private final StockRepository stockRepository;
    private final StockMovementRepository stockMovementRepository;
    private final WarehouseRepository warehouseRepository;
    private final ProductRepository productRepository;
    private final AuditService auditService;
    private final InventoryService inventoryService;

    public StockAdjustmentService(
            StockRepository stockRepository,
            StockMovementRepository stockMovementRepository,
            WarehouseRepository warehouseRepository,
            ProductRepository productRepository,
            AuditService auditService,
            InventoryService inventoryService
    ) {
        this.stockRepository = stockRepository;
        this.stockMovementRepository = stockMovementRepository;
        this.warehouseRepository = warehouseRepository;
        this.productRepository = productRepository;
        this.auditService = auditService;
        this.inventoryService = inventoryService;
    }

    @Transactional
    public StockDto adjustStock(StockAdjustmentRequest request) {
        SecurityUtils.validateWarehouseAccess(request.getWarehouseId());

        if (request.getReason() == null || request.getReason().trim().isEmpty()) {
            throw new BusinessException("A mandatory reason must be provided for every manual stock adjustment");
        }
        if (request.getQuantity() == 0) {
            throw new BusinessException("Adjustment quantity cannot be 0");
        }

        Warehouse warehouse = warehouseRepository.findById(request.getWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found with id: " + request.getWarehouseId()));
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + request.getProductId()));

        Stock stock = stockRepository.findWithLockByWarehouseIdAndProductId(warehouse.getId(), product.getId())
                .orElseGet(() -> stockRepository.save(new Stock(warehouse, product, 0, 0)));

        int oldPhysical = stock.getPhysicalQuantity();
        int newPhysical = oldPhysical + request.getQuantity();

        if (newPhysical < stock.getReservedQuantity() || newPhysical < 0) {
            throw new InsufficientStockException(
                    "Cannot decrease stock below reserved quantity. Available: " + stock.getAvailableQuantity() +
                    ", Attempted deduction: " + Math.abs(request.getQuantity())
            );
        }

        stock.setPhysicalQuantity(newPhysical);
        Stock savedStock = stockRepository.save(stock);

        User currentUser = SecurityUtils.getCurrentUser();
        StockMovement movement = new StockMovement(
                warehouse,
                product,
                StockMovementType.ADJUSTMENT,
                request.getQuantity(),
                "MANUAL_ADJUSTMENT",
                savedStock.getId(),
                request.getReason().trim(),
                currentUser
        );
        stockMovementRepository.save(movement);

        auditService.logAction(
                "STOCK_ADJUSTED",
                "STOCK",
                savedStock.getId(),
                warehouse,
                "Physical: " + oldPhysical,
                "Physical: " + newPhysical + " (Delta: " + (request.getQuantity() > 0 ? "+" : "") + request.getQuantity() + ")",
                "Stock adjusted for " + product.getName() + ". Reason: " + request.getReason().trim()
        );

        return inventoryService.mapToDto(savedStock);
    }
}
