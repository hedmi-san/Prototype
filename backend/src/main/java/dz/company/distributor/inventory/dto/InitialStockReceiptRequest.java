package dz.company.distributor.inventory.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class InitialStockReceiptRequest {

    @NotNull(message = "Warehouse ID is required")
    private Long warehouseId;

    @NotNull(message = "Product ID is required")
    private Long productId;

    @NotNull(message = "Quantity is required")
    @Min(value = 1, message = "Quantity must be at least 1")
    private Integer quantity;

    @NotBlank(message = "Reference / Batch number is required")
    private String reference = "INIT-STOCK";

    private String notes;

    public InitialStockReceiptRequest() {}

    public InitialStockReceiptRequest(Long warehouseId, Long productId, Integer quantity, String notes) {
        this.warehouseId = warehouseId;
        this.productId = productId;
        this.quantity = quantity;
        this.reference = "INIT-STOCK";
        this.notes = notes;
    }

    public InitialStockReceiptRequest(Long warehouseId, Long productId, Integer quantity, String reference, String notes) {
        this.warehouseId = warehouseId;
        this.productId = productId;
        this.quantity = quantity;
        this.reference = reference != null ? reference : "INIT-STOCK";
        this.notes = notes;
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

    public String getReference() {
        return reference;
    }

    public void setReference(String reference) {
        this.reference = reference;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}
