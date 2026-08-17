package dz.company.distributor.products;

import dz.company.distributor.audit.AuditService;
import dz.company.distributor.common.exception.BusinessException;
import dz.company.distributor.common.exception.ResourceNotFoundException;
import dz.company.distributor.products.dto.ProductDto;
import dz.company.distributor.products.dto.ProductPriceUpdateRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final AuditService auditService;

    public ProductService(ProductRepository productRepository, AuditService auditService) {
        this.productRepository = productRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<ProductDto> getAllProducts() {
        return productRepository.findAll().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ProductDto> getActiveProducts() {
        return productRepository.findByActiveTrue().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ProductDto getProductById(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + id));
        return mapToDto(product);
    }

    @Transactional
    public ProductDto createProduct(ProductDto dto) {
        if (productRepository.existsByReference(dto.getReference())) {
            throw new BusinessException("Product reference already exists: " + dto.getReference());
        }

        Product product = new Product(
                dto.getReference(),
                dto.getName(),
                dto.getBrand(),
                dto.getPurchasePrice(),
                dto.getSalePrice(),
                dto.getUnit(),
                true
        );

        Product saved = productRepository.save(product);

        auditService.logAction(
                "PRODUCT_CREATED",
                "PRODUCT",
                saved.getId(),
                null,
                null,
                saved.getName() + " (" + saved.getReference() + ")",
                "Created product " + saved.getName()
        );

        return mapToDto(saved);
    }

    @Transactional
    public ProductDto updateProduct(Long id, ProductDto dto) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + id));

        product.setName(dto.getName());
        product.setBrand(dto.getBrand());
        product.setPurchasePrice(dto.getPurchasePrice());
        product.setSalePrice(dto.getSalePrice());
        product.setUnit(dto.getUnit());
        product.setActive(dto.isActive());

        Product updated = productRepository.save(product);

        auditService.logAction(
                "PRODUCT_UPDATED",
                "PRODUCT",
                updated.getId(),
                null,
                null,
                updated.getName(),
                "Updated master product data for " + updated.getName()
        );

        return mapToDto(updated);
    }

    @Transactional
    public ProductDto updateProductPrices(Long id, ProductPriceUpdateRequest request) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + id));

        String oldPrices = "Purchase: " + product.getPurchasePrice() + " DZD, Sale: " + product.getSalePrice() + " DZD";
        String newPrices = "Purchase: " + request.getPurchasePrice() + " DZD, Sale: " + request.getSalePrice() + " DZD";

        product.setPurchasePrice(request.getPurchasePrice());
        product.setSalePrice(request.getSalePrice());

        Product updated = productRepository.save(product);

        auditService.logAction(
                "PRICE_CHANGED",
                "PRODUCT",
                updated.getId(),
                null,
                oldPrices,
                newPrices,
                "Updated purchase and sale prices for " + updated.getName()
        );

        return mapToDto(updated);
    }

    public ProductDto mapToDto(Product product) {
        return new ProductDto(
                product.getId(),
                product.getReference(),
                product.getName(),
                product.getBrand(),
                product.getPurchasePrice(),
                product.getSalePrice(),
                product.getUnit(),
                product.isActive(),
                product.getCreatedAt(),
                product.getUpdatedAt()
        );
    }
}
