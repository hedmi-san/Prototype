package dz.company.distributor.inventory;

import dz.company.distributor.common.response.ApiResponse;
import dz.company.distributor.inventory.dto.InitialStockReceiptRequest;
import dz.company.distributor.inventory.dto.StockAdjustmentRequest;
import dz.company.distributor.inventory.dto.StockDto;
import dz.company.distributor.inventory.dto.StockMovementDto;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/inventory")
public class InventoryController {

    private final InventoryService inventoryService;
    private final StockAdjustmentService stockAdjustmentService;

    public InventoryController(InventoryService inventoryService, StockAdjustmentService stockAdjustmentService) {
        this.inventoryService = inventoryService;
        this.stockAdjustmentService = stockAdjustmentService;
    }

    @GetMapping("/stock")
    public ResponseEntity<ApiResponse<List<StockDto>>> getStock(@RequestParam(required = false) Long warehouseId) {
        List<StockDto> stockList = inventoryService.getStockByWarehouse(warehouseId);
        return ResponseEntity.ok(ApiResponse.success(stockList));
    }

    @GetMapping("/movements")
    public ResponseEntity<ApiResponse<List<StockMovementDto>>> getMovements(
            @RequestParam(required = false) Long warehouseId) {
        List<StockMovementDto> movements = inventoryService.getMovements(warehouseId);
        return ResponseEntity.ok(ApiResponse.success(movements));
    }

    @PostMapping("/adjustments")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'ACCOUNTANT')")
    public ResponseEntity<ApiResponse<StockDto>> adjustStock(@Valid @RequestBody StockAdjustmentRequest request) {
        StockDto updatedStock = stockAdjustmentService.adjustStock(request);
        return ResponseEntity.ok(ApiResponse.success("Stock adjusted successfully", updatedStock));
    }

    @PostMapping("/initial-receipt")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<StockDto>> recordInitialStock(
            @Valid @RequestBody InitialStockReceiptRequest request) {
        StockDto stock = inventoryService.recordInitialStock(request);
        return ResponseEntity.ok(ApiResponse.success("Stock received successfully", stock));
    }
}
