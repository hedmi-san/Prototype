package dz.company.distributor.products;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "products")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String reference;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false, length = 100)
    private String brand;

    @Column(length = 100)
    private String category = "Tools";

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "unit_purchase_price", nullable = false, precision = 15, scale = 2)
    private BigDecimal purchasePrice;

    @Column(name = "unit_sale_price", nullable = false, precision = 15, scale = 2)
    private BigDecimal salePrice;

    @Column(name = "min_stock_alert", nullable = false)
    private int minStockAlert = 5;

    @Column(nullable = false, length = 20)
    private String unit = "PIECE";

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public Product() {}

    public Product(String reference, String name, String brand, BigDecimal purchasePrice, BigDecimal salePrice, String unit, boolean active) {
        this.reference = reference;
        this.name = name;
        this.brand = brand;
        this.purchasePrice = purchasePrice;
        this.salePrice = salePrice;
        this.unit = unit != null ? unit : "PIECE";
        this.active = active;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public Product(String reference, String name, String brand, String category, String description,
                   BigDecimal purchasePrice, BigDecimal salePrice, int minStockAlert) {
        this.reference = reference;
        this.name = name;
        this.brand = brand;
        this.category = category;
        this.description = description;
        this.purchasePrice = purchasePrice;
        this.salePrice = salePrice;
        this.minStockAlert = minStockAlert;
        this.unit = "PIECE";
        this.active = true;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
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

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
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

    public int getMinStockAlert() {
        return minStockAlert;
    }

    public void setMinStockAlert(int minStockAlert) {
        this.minStockAlert = minStockAlert;
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
