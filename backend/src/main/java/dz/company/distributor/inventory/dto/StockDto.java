package dz.company.distributor.inventory.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class StockDto {
    private Long id;
    private Long warehouseId;
    private String warehouseName;
    private String warehouseCode;
    private Long productId;
    private String productReference;
    private String productName;
    private String productBrand;
    private String productUnit;
    private BigDecimal productPurchasePrice;
    private BigDecimal productSalePrice;
    private int physicalQuantity;
    private int reservedQuantity;
    private int availableQuantity;
    private BigDecimal totalValuation;
    private LocalDateTime updatedAt;

    public StockDto() {}

    public StockDto(Long id, Long warehouseId, String warehouseName, String warehouseCode, Long productId, String productReference, String productName, String productBrand, String productUnit, BigDecimal productPurchasePrice, BigDecimal productSalePrice, int physicalQuantity, int reservedQuantity, int availableQuantity, BigDecimal totalValuation, LocalDateTime updatedAt) {
        this.id = id;
        this.warehouseId = warehouseId;
        this.warehouseName = warehouseName;
        this.warehouseCode = warehouseCode;
        this.productId = productId;
        this.productReference = productReference;
        this.productName = productName;
        this.productBrand = productBrand;
        this.productUnit = productUnit;
        this.productPurchasePrice = productPurchasePrice;
        this.productSalePrice = productSalePrice;
        this.physicalQuantity = physicalQuantity;
        this.reservedQuantity = reservedQuantity;
        this.availableQuantity = availableQuantity;
        this.totalValuation = totalValuation;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getWarehouseId() {
        return warehouseId;
    }

    public void setWarehouseId(Long warehouseId) {
        this.warehouseId = warehouseId;
    }

    public String getWarehouseName() {
        return warehouseName;
    }

    public void setWarehouseName(String warehouseName) {
        this.warehouseName = warehouseName;
    }

    public String getWarehouseCode() {
        return warehouseCode;
    }

    public void setWarehouseCode(String warehouseCode) {
        this.warehouseCode = warehouseCode;
    }

    public Long getProductId() {
        return productId;
    }

    public void setProductId(Long productId) {
        this.productId = productId;
    }

    public String getProductReference() {
        return productReference;
    }

    public void setProductReference(String productReference) {
        this.productReference = productReference;
    }

    public String getProductName() {
        return productName;
    }

    public void setProductName(String productName) {
        this.productName = productName;
    }

    public String getProductBrand() {
        return productBrand;
    }

    public void setProductBrand(String productBrand) {
        this.productBrand = productBrand;
    }

    public String getProductUnit() {
        return productUnit;
    }

    public void setProductUnit(String productUnit) {
        this.productUnit = productUnit;
    }

    public BigDecimal getProductPurchasePrice() {
        return productPurchasePrice;
    }

    public void setProductPurchasePrice(BigDecimal productPurchasePrice) {
        this.productPurchasePrice = productPurchasePrice;
    }

    public BigDecimal getProductSalePrice() {
        return productSalePrice;
    }

    public void setProductSalePrice(BigDecimal productSalePrice) {
        this.productSalePrice = productSalePrice;
    }

    public int getPhysicalQuantity() {
        return physicalQuantity;
    }

    public void setPhysicalQuantity(int physicalQuantity) {
        this.physicalQuantity = physicalQuantity;
    }

    public int getReservedQuantity() {
        return reservedQuantity;
    }

    public void setReservedQuantity(int reservedQuantity) {
        this.reservedQuantity = reservedQuantity;
    }

    public int getAvailableQuantity() {
        return availableQuantity;
    }

    public void setAvailableQuantity(int availableQuantity) {
        this.availableQuantity = availableQuantity;
    }

    public BigDecimal getTotalValuation() {
        return totalValuation;
    }

    public void setTotalValuation(BigDecimal totalValuation) {
        this.totalValuation = totalValuation;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
