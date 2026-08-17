package dz.company.distributor.sales;

import dz.company.distributor.common.response.ApiResponse;
import dz.company.distributor.sales.dto.CreateSaleRequest;
import dz.company.distributor.sales.dto.SaleDto;
import dz.company.distributor.sales.dto.UpdateSaleRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/sales")
public class SaleController {

    private final SaleService saleService;

    public SaleController(SaleService saleService) {
        this.saleService = saleService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<SaleDto>>> getSales(@RequestParam(required = false) Long warehouseId) {
        List<SaleDto> sales = saleService.getSales(warehouseId);
        return ResponseEntity.ok(ApiResponse.success(sales));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<SaleDto>> getSaleById(@PathVariable Long id) {
        SaleDto sale = saleService.getSaleById(id);
        return ResponseEntity.ok(ApiResponse.success(sale));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'ACCOUNTANT')")
    public ResponseEntity<ApiResponse<SaleDto>> createSale(@Valid @RequestBody CreateSaleRequest request) {
        SaleDto created = saleService.createSale(request);
        return ResponseEntity.ok(ApiResponse.success("Sale created successfully", created));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'ACCOUNTANT')")
    public ResponseEntity<ApiResponse<SaleDto>> updateSale(@PathVariable Long id,
            @Valid @RequestBody UpdateSaleRequest request) {
        SaleDto updated = saleService.updateSale(id, request);
        return ResponseEntity.ok(ApiResponse.success("Sale updated successfully", updated));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'ACCOUNTANT')")
    public ResponseEntity<ApiResponse<SaleDto>> cancelSale(@PathVariable Long id) {
        SaleDto cancelled = saleService.cancelSale(id);
        return ResponseEntity.ok(ApiResponse.success("Sale cancelled successfully and stock restored", cancelled));
    }
}
