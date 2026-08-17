package dz.company.distributor.products;

import dz.company.distributor.common.response.ApiResponse;
import dz.company.distributor.products.dto.ProductDto;
import dz.company.distributor.products.dto.ProductPriceUpdateRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ProductDto>>> getAllProducts() {
        List<ProductDto> list = productService.getAllProducts();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/active")
    public ResponseEntity<ApiResponse<List<ProductDto>>> getActiveProducts() {
        List<ProductDto> list = productService.getActiveProducts();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ProductDto>> getProductById(@PathVariable Long id) {
        ProductDto product = productService.getProductById(id);
        return ResponseEntity.ok(ApiResponse.success(product));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'ACCOUNTANT')")
    public ResponseEntity<ApiResponse<ProductDto>> createProduct(@Valid @RequestBody ProductDto dto) {
        ProductDto created = productService.createProduct(dto);
        return ResponseEntity.ok(ApiResponse.success("Product created successfully", created));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'ACCOUNTANT')")
    public ResponseEntity<ApiResponse<ProductDto>> updateProduct(@PathVariable Long id,
            @Valid @RequestBody ProductDto dto) {
        ProductDto updated = productService.updateProduct(id, dto);
        return ResponseEntity.ok(ApiResponse.success("Product updated successfully", updated));
    }

    @PatchMapping("/{id}/prices")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'ACCOUNTANT')")
    public ResponseEntity<ApiResponse<ProductDto>> updateProductPrices(@PathVariable Long id,
            @Valid @RequestBody ProductPriceUpdateRequest request) {
        ProductDto updated = productService.updateProductPrices(id, request);
        return ResponseEntity.ok(ApiResponse.success("Product prices updated successfully", updated));
    }
}
