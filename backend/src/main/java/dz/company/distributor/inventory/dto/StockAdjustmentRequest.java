package dz.company.distributor.inventory.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class StockAdjustmentRequest {

    @NotNull(message = "Warehouse ID is required")
    private Long warehouseId;

    @NotNull(message = "Product ID is required")
    private Long productId;

    @NotNull(message = "Adjustment quantity is required (positive for increase, negative for decrease)")
    private Integer quantity; // Can be positive or negative

    @NotBlank(message = "Mandatory reason is required for any manual stock adjustment")
    private String reason;

    public StockAdjustmentRequest() {}

    public StockAdjustmentRequest(Long warehouseId, Long productId, Integer quantity, String reason) {
        this.warehouseId = warehouseId;
        this.productId = productId;
        this.quantity = quantity;
        this.reason = reason;
    }

    public Long getWarehouseId() {
        return warehouseId;
    }

    public void setWarehouseId(Long warehouseId) {
        this.warehouseId = warehouseId;
    }

    public Long getProductId() {
        return productId;
    }

    public void setProductId(Long productId) {
        this.productId = productId;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
