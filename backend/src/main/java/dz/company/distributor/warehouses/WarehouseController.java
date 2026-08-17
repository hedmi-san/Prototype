package dz.company.distributor.warehouses;

import dz.company.distributor.common.response.ApiResponse;
import dz.company.distributor.warehouses.dto.WarehouseDto;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/warehouses")
public class WarehouseController {

    private final WarehouseService warehouseService;

    public WarehouseController(WarehouseService warehouseService) {
        this.warehouseService = warehouseService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<WarehouseDto>>> getAllWarehouses() {
        List<WarehouseDto> list = warehouseService.getAllWarehouses();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/active")
    public ResponseEntity<ApiResponse<List<WarehouseDto>>> getActiveWarehouses() {
        List<WarehouseDto> list = warehouseService.getActiveWarehouses();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<WarehouseDto>> getWarehouseById(@PathVariable Long id) {
        WarehouseDto warehouse = warehouseService.getWarehouseById(id);
        return ResponseEntity.ok(ApiResponse.success(warehouse));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<WarehouseDto>> createWarehouse(@RequestBody WarehouseDto dto) {
        WarehouseDto created = warehouseService.createWarehouse(dto);
        return ResponseEntity.ok(ApiResponse.success("Warehouse created successfully", created));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<WarehouseDto>> updateWarehouse(@PathVariable Long id,
            @RequestBody WarehouseDto dto) {
        WarehouseDto updated = warehouseService.updateWarehouse(id, dto);
        return ResponseEntity.ok(ApiResponse.success("Warehouse updated successfully", updated));
    }
}
