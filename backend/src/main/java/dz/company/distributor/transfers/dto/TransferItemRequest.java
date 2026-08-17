package dz.company.distributor.transfers.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class TransferItemRequest {

    @NotNull(message = "Product ID is required")
    private Long productId;

    @NotNull(message = "Requested quantity is required")
    @Min(value = 1, message = "Quantity must be at least 1")
    private Integer requestedQuantity;

    public TransferItemRequest() {}

    public TransferItemRequest(Long productId, Integer requestedQuantity) {
        this.productId = productId;
        this.requestedQuantity = requestedQuantity;
    }

    public Long getProductId() {
        return productId;
    }

    public void setProductId(Long productId) {
        this.productId = productId;
    }

    public Integer getRequestedQuantity() {
        return requestedQuantity;
    }

    public void setRequestedQuantity(Integer requestedQuantity) {
        this.requestedQuantity = requestedQuantity;
    }
}
