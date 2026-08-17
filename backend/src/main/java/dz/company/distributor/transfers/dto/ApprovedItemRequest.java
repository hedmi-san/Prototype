package dz.company.distributor.transfers.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class ApprovedItemRequest {

    @NotNull(message = "Product ID is required")
    private Long productId;

    @NotNull(message = "Approved quantity is required")
    @Min(value = 0, message = "Approved quantity cannot be negative")
    private Integer approvedQuantity;

    public ApprovedItemRequest() {}

    public ApprovedItemRequest(Long productId, Integer approvedQuantity) {
        this.productId = productId;
        this.approvedQuantity = approvedQuantity;
    }

    public Long getProductId() {
        return productId;
    }

    public void setProductId(Long productId) {
        this.productId = productId;
    }

    public Integer getApprovedQuantity() {
        return approvedQuantity;
    }

    public void setApprovedQuantity(Integer approvedQuantity) {
        this.approvedQuantity = approvedQuantity;
    }
}
