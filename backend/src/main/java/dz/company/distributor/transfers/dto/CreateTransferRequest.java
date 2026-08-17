package dz.company.distributor.transfers.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public class CreateTransferRequest {

    @NotNull(message = "Source warehouse ID is required")
    private Long sourceWarehouseId;

    @NotNull(message = "Destination warehouse ID is required")
    private Long destinationWarehouseId;

    private String notes;

    @NotEmpty(message = "Transfer must contain at least one item")
    @Valid
    private List<TransferItemRequest> items;

    public CreateTransferRequest() {}

    public CreateTransferRequest(Long sourceWarehouseId, Long destinationWarehouseId, String notes, List<TransferItemRequest> items) {
        this.sourceWarehouseId = sourceWarehouseId;
        this.destinationWarehouseId = destinationWarehouseId;
        this.notes = notes;
        this.items = items;
    }

    public Long getSourceWarehouseId() {
        return sourceWarehouseId;
    }

    public void setSourceWarehouseId(Long sourceWarehouseId) {
        this.sourceWarehouseId = sourceWarehouseId;
    }

    public Long getDestinationWarehouseId() {
        return destinationWarehouseId;
    }

    public void setDestinationWarehouseId(Long destinationWarehouseId) {
        this.destinationWarehouseId = destinationWarehouseId;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public List<TransferItemRequest> getItems() {
        return items;
    }

    public void setItems(List<TransferItemRequest> items) {
        this.items = items;
    }
}
