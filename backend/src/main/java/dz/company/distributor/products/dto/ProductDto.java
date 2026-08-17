package dz.company.distributor.products.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class ProductDto {
    private Long id;
    private String reference;
    private String name;
    private String brand;
    private BigDecimal purchasePrice;
    private BigDecimal salePrice;
    private String unit;
    private boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public ProductDto() {}

    public ProductDto(Long id, String reference, String name, String brand, BigDecimal purchasePrice, BigDecimal salePrice, String unit, boolean active, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.id = id;
        this.reference = reference;
        this.name = name;
        this.brand = brand;
        this.purchasePrice = purchasePrice;
        this.salePrice = salePrice;
        this.unit = unit;
        this.active = active;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getReference() {
        return reference;
    }

    public void setReference(String reference) {
        this.reference = reference;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getBrand() {
        return brand;
    }

    public void setBrand(String brand) {
        this.brand = brand;
    }

    public BigDecimal getPurchasePrice() {
        return purchasePrice;
    }

    public void setPurchasePrice(BigDecimal purchasePrice) {
        this.purchasePrice = purchasePrice;
    }

    public BigDecimal getSalePrice() {
        return salePrice;
    }

    public void setSalePrice(BigDecimal salePrice) {
        this.salePrice = salePrice;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
