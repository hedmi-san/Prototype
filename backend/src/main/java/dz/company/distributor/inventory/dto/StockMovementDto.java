package dz.company.distributor.inventory.dto;

import dz.company.distributor.inventory.StockMovementType;
import java.time.LocalDateTime;

public class StockMovementDto {
    private Long id;
    private Long warehouseId;
    private String warehouseName;
    private Long productId;
    private String productReference;
    private String productName;
    private StockMovementType type;
    private int quantity;
    private String referenceType;
    private Long referenceId;
    private String reason;
    private Long createdById;
    private String createdByName;
    private LocalDateTime createdAt;

    public StockMovementDto() {}

    public StockMovementDto(Long id, Long warehouseId, String warehouseName, Long productId, String productReference, String productName, StockMovementType type, int quantity, String referenceType, Long referenceId, String reason, Long createdById, String createdByName, LocalDateTime createdAt) {
        this.id = id;
        this.warehouseId = warehouseId;
        this.warehouseName = warehouseName;
        this.productId = productId;
        this.productReference = productReference;
        this.productName = productName;
        this.type = type;
        this.quantity = quantity;
        this.referenceType = referenceType;
        this.referenceId = referenceId;
        this.reason = reason;
        this.createdById = createdById;
        this.createdByName = createdByName;
        this.createdAt = createdAt;
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

    public StockMovementType getType() {
        return type;
    }

    public void setType(StockMovementType type) {
        this.type = type;
    }

    public int getQuantity() {
        return quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public String getReferenceType() {
        return referenceType;
    }

    public void setReferenceType(String referenceType) {
        this.referenceType = referenceType;
    }

    public Long getReferenceId() {
        return referenceId;
    }

    public void setReferenceId(Long referenceId) {
        this.referenceId = referenceId;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public Long getCreatedById() {
        return createdById;
    }

    public void setCreatedById(Long createdById) {
        this.createdById = createdById;
    }

    public String getCreatedByName() {
        return createdByName;
    }

    public void setCreatedByName(String createdByName) {
        this.createdByName = createdByName;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
