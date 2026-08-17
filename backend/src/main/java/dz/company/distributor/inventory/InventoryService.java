package dz.company.distributor.inventory;

import dz.company.distributor.audit.AuditService;
import dz.company.distributor.common.exception.InsufficientStockException;
import dz.company.distributor.common.exception.ResourceNotFoundException;
import dz.company.distributor.inventory.dto.InitialStockReceiptRequest;
import dz.company.distributor.inventory.dto.StockDto;
import dz.company.distributor.inventory.dto.StockMovementDto;
import dz.company.distributor.products.Product;
import dz.company.distributor.products.ProductRepository;
import dz.company.distributor.security.SecurityUtils;
import dz.company.distributor.users.User;
import dz.company.distributor.warehouses.Warehouse;
import dz.company.distributor.warehouses.WarehouseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class InventoryService {

    private final StockRepository stockRepository;
    private final StockMovementRepository stockMovementRepository;
    private final WarehouseRepository warehouseRepository;
    private final ProductRepository productRepository;
    private final AuditService auditService;

    public InventoryService(
            StockRepository stockRepository,
            StockMovementRepository stockMovementRepository,
            WarehouseRepository warehouseRepository,
            ProductRepository productRepository,
            AuditService auditService
    ) {
        this.stockRepository = stockRepository;
        this.stockMovementRepository = stockMovementRepository;
        this.warehouseRepository = warehouseRepository;
        this.productRepository = productRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<StockDto> getStockByWarehouse(Long warehouseId) {
        if (warehouseId != null && !SecurityUtils.isAdmin() && !SecurityUtils.isSuperManager()) {
            SecurityUtils.validateWarehouseAccess(warehouseId);
        }
        List<Stock> stocks = (warehouseId != null) 
                ? stockRepository.findByWarehouseId(warehouseId)
                : stockRepository.findAll();
        return stocks.stream().map(this::mapToDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<StockDto> getAllStock() {
        return stockRepository.findAll().stream().map(this::mapToDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<StockMovementDto> getMovements(Long warehouseId) {
        if (warehouseId != null && !SecurityUtils.isAdmin() && !SecurityUtils.isSuperManager()) {
            SecurityUtils.validateWarehouseAccess(warehouseId);
        }
        List<StockMovement> movements = (warehouseId != null)
                ? stockMovementRepository.findByWarehouseIdOrderByCreatedAtDesc(warehouseId)
                : stockMovementRepository.findAllByOrderByCreatedAtDesc();
        return movements.stream().map(this::mapMovementToDto).collect(Collectors.toList());
    }

    @Transactional
    public Stock getOrCreateStock(Warehouse warehouse, Product product) {
        return stockRepository.findByWarehouseIdAndProductId(warehouse.getId(), product.getId())
                .orElseGet(() -> stockRepository.save(new Stock(warehouse, product, 0, 0)));
    }

    @Transactional
    public StockDto recordInitialStock(InitialStockReceiptRequest request) {
        SecurityUtils.validateWarehouseAccess(request.getWarehouseId());

        Warehouse warehouse = warehouseRepository.findById(request.getWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found with id: " + request.getWarehouseId()));
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + request.getProductId()));

        Stock stock = stockRepository.findWithLockByWarehouseIdAndProductId(warehouse.getId(), product.getId())
                .orElseGet(() -> stockRepository.save(new Stock(warehouse, product, 0, 0)));

        stock.setPhysicalQuantity(stock.getPhysicalQuantity() + request.getQuantity());
        Stock savedStock = stockRepository.save(stock);

        User currentUser = SecurityUtils.getCurrentUser();
        StockMovement movement = new StockMovement(
                warehouse,
                product,
                StockMovementType.INITIAL_STOCK,
                request.getQuantity(),
                "RECEIPT",
                null,
                request.getReference() + (request.getNotes() != null ? " - " + request.getNotes() : ""),
                currentUser
        );
        stockMovementRepository.save(movement);

        auditService.logAction(
                "INITIAL_STOCK_RECEIVED",
                "STOCK",
                savedStock.getId(),
                warehouse,
                null,
                "+" + request.getQuantity() + " units of " + product.getName(),
                "Received initial stock shipment " + request.getReference()
        );

        return mapToDto(savedStock);
    }

    @Transactional
    public void deductStock(Long warehouseId, Long productId, int quantity, String referenceType, Long referenceId, StockMovementType movementType, String reason) {
        Stock stock = stockRepository.findWithLockByWarehouseIdAndProductId(warehouseId, productId)
                .orElseThrow(() -> new InsufficientStockException("Stock record not found for product ID " + productId + " in warehouse " + warehouseId));

        if (stock.getAvailableQuantity() < quantity) {
            throw new InsufficientStockException(
                    "Insufficient available stock for product " + stock.getProduct().getName() +
                    ". Available: " + stock.getAvailableQuantity() + ", Requested: " + quantity
            );
        }

        stock.setPhysicalQuantity(stock.getPhysicalQuantity() - quantity);
        stockRepository.save(stock);

        User currentUser = null;
        try {
            currentUser = SecurityUtils.getCurrentUser();
        } catch (Exception ignored) {}

        StockMovement movement = new StockMovement(
                stock.getWarehouse(),
                stock.getProduct(),
                movementType,
                -quantity,
                referenceType,
                referenceId,
                reason,
                currentUser
        );
        stockMovementRepository.save(movement);
    }

    @Transactional
    public void addStock(Long warehouseId, Long productId, int quantity, String referenceType, Long referenceId, StockMovementType movementType, String reason) {
        Warehouse warehouse = warehouseRepository.findById(warehouseId)
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found: " + warehouseId));
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + productId));

        Stock stock = stockRepository.findWithLockByWarehouseIdAndProductId(warehouseId, productId)
                .orElseGet(() -> stockRepository.save(new Stock(warehouse, product, 0, 0)));

        stock.setPhysicalQuantity(stock.getPhysicalQuantity() + quantity);
        stockRepository.save(stock);

        User currentUser = null;
        try {
            currentUser = SecurityUtils.getCurrentUser();
        } catch (Exception ignored) {}

        StockMovement movement = new StockMovement(
                warehouse,
                product,
                movementType,
                quantity,
                referenceType,
                referenceId,
                reason,
                currentUser
        );
        stockMovementRepository.save(movement);
    }

    @Transactional
    public void reserveStock(Long warehouseId, Long productId, int quantity) {
        Stock stock = stockRepository.findWithLockByWarehouseIdAndProductId(warehouseId, productId)
                .orElseThrow(() -> new InsufficientStockException("Stock record not found for product ID " + productId + " in warehouse " + warehouseId));

        if (stock.getAvailableQuantity() < quantity) {
            throw new InsufficientStockException(
                    "Cannot reserve stock for " + stock.getProduct().getName() +
                    ". Available: " + stock.getAvailableQuantity() + ", Requested: " + quantity
            );
        }

        stock.setReservedQuantity(stock.getReservedQuantity() + quantity);
        stockRepository.save(stock);
    }

    @Transactional
    public void releaseReservedStock(Long warehouseId, Long productId, int quantity) {
        Stock stock = stockRepository.findWithLockByWarehouseIdAndProductId(warehouseId, productId)
                .orElseThrow(() -> new ResourceNotFoundException("Stock record not found"));

        stock.setReservedQuantity(Math.max(0, stock.getReservedQuantity() - quantity));
        stockRepository.save(stock);
    }

    @Transactional
    public void fulfillTransfer(Long sourceWarehouseId, Long destWarehouseId, Long productId, int quantity, Long transferId) {
        // 1. Source warehouse: Deduct from physical and release from reserved
        Stock sourceStock = stockRepository.findWithLockByWarehouseIdAndProductId(sourceWarehouseId, productId)
                .orElseThrow(() -> new InsufficientStockException("Source stock record not found"));

        sourceStock.setPhysicalQuantity(sourceStock.getPhysicalQuantity() - quantity);
        sourceStock.setReservedQuantity(Math.max(0, sourceStock.getReservedQuantity() - quantity));
        stockRepository.save(sourceStock);

        User currentUser = null;
        try {
            currentUser = SecurityUtils.getCurrentUser();
        } catch (Exception ignored) {}

        StockMovement outMovement = new StockMovement(
                sourceStock.getWarehouse(),
                sourceStock.getProduct(),
                StockMovementType.TRANSFER_OUT,
                -quantity,
                "TRANSFER",
                transferId,
                "Transfer out to " + destWarehouseId,
                currentUser
        );
        stockMovementRepository.save(outMovement);

        // 2. Destination warehouse: Add to physical
        Warehouse destWarehouse = warehouseRepository.findById(destWarehouseId)
                .orElseThrow(() -> new ResourceNotFoundException("Destination warehouse not found: " + destWarehouseId));

        Stock destStock = stockRepository.findWithLockByWarehouseIdAndProductId(destWarehouseId, productId)
                .orElseGet(() -> stockRepository.save(new Stock(destWarehouse, sourceStock.getProduct(), 0, 0)));

        destStock.setPhysicalQuantity(destStock.getPhysicalQuantity() + quantity);
        stockRepository.save(destStock);

        StockMovement inMovement = new StockMovement(
                destWarehouse,
                sourceStock.getProduct(),
                StockMovementType.TRANSFER_IN,
                quantity,
                "TRANSFER",
                transferId,
                "Transfer in from " + sourceStock.getWarehouse().getName(),
                currentUser
        );
        stockMovementRepository.save(inMovement);
    }

    public StockDto mapToDto(Stock stock) {
        BigDecimal valuation = stock.getProduct().getPurchasePrice().multiply(BigDecimal.valueOf(stock.getPhysicalQuantity()));
        return new StockDto(
                stock.getId(),
                stock.getWarehouse().getId(),
                stock.getWarehouse().getName(),
                stock.getWarehouse().getCode(),
                stock.getProduct().getId(),
                stock.getProduct().getReference(),
                stock.getProduct().getName(),
                stock.getProduct().getBrand(),
                stock.getProduct().getUnit(),
                stock.getProduct().getPurchasePrice(),
                stock.getProduct().getSalePrice(),
                stock.getPhysicalQuantity(),
                stock.getReservedQuantity(),
                stock.getAvailableQuantity(),
                valuation,
                stock.getUpdatedAt()
        );
    }

    public StockMovementDto mapMovementToDto(StockMovement movement) {
        return new StockMovementDto(
                movement.getId(),
                movement.getWarehouse().getId(),
                movement.getWarehouse().getName(),
                movement.getProduct().getId(),
                movement.getProduct().getReference(),
                movement.getProduct().getName(),
                movement.getType(),
                movement.getQuantity(),
                movement.getReferenceType(),
                movement.getReferenceId(),
                movement.getReason(),
                movement.getCreatedBy() != null ? movement.getCreatedBy().getId() : null,
                movement.getCreatedBy() != null ? movement.getCreatedBy().getFullName() : "System",
                movement.getCreatedAt()
        );
    }
}
