package dz.company.distributor.transfers.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public class ApproveTransferRequest {

    @NotEmpty(message = "Approved items list must not be empty")
    @Valid
    private List<ApprovedItemRequest> items;

    public ApproveTransferRequest() {}

    public ApproveTransferRequest(List<ApprovedItemRequest> items) {
        this.items = items;
    }

    public List<ApprovedItemRequest> getItems() {
        return items;
    }

    public void setItems(List<ApprovedItemRequest> items) {
        this.items = items;
    }
}
