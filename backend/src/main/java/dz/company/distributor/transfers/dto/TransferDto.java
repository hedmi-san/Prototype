package dz.company.distributor.transfers.dto;

import dz.company.distributor.transfers.TransferStatus;
import java.time.LocalDateTime;
import java.util.List;

public class TransferDto {
    private Long id;
    private Long sourceWarehouseId;
    private String sourceWarehouseName;
    private String sourceWarehouseCode;
    private Long destinationWarehouseId;
    private String destinationWarehouseName;
    private String destinationWarehouseCode;
    private TransferStatus status;
    private Long createdById;
    private String createdByName;
    private String notes;
    private List<TransferItemDto> items;
    private LocalDateTime createdAt;
    private LocalDateTime approvedAt;
    private LocalDateTime confirmedAt;
    private LocalDateTime updatedAt;

    public TransferDto() {}

    public TransferDto(Long id, Long sourceWarehouseId, String sourceWarehouseName, String sourceWarehouseCode, Long destinationWarehouseId, String destinationWarehouseName, String destinationWarehouseCode, TransferStatus status, Long createdById, String createdByName, String notes, List<TransferItemDto> items, LocalDateTime createdAt, LocalDateTime approvedAt, LocalDateTime confirmedAt, LocalDateTime updatedAt) {
        this.id = id;
        this.sourceWarehouseId = sourceWarehouseId;
        this.sourceWarehouseName = sourceWarehouseName;
        this.sourceWarehouseCode = sourceWarehouseCode;
        this.destinationWarehouseId = destinationWarehouseId;
        this.destinationWarehouseName = destinationWarehouseName;
        this.destinationWarehouseCode = destinationWarehouseCode;
        this.status = status;
        this.createdById = createdById;
        this.createdByName = createdByName;
        this.notes = notes;
        this.items = items;
        this.createdAt = createdAt;
        this.approvedAt = approvedAt;
        this.confirmedAt = confirmedAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getSourceWarehouseId() {
        return sourceWarehouseId;
    }

    public void setSourceWarehouseId(Long sourceWarehouseId) {
        this.sourceWarehouseId = sourceWarehouseId;
    }

    public String getSourceWarehouseName() {
        return sourceWarehouseName;
    }

    public void setSourceWarehouseName(String sourceWarehouseName) {
        this.sourceWarehouseName = sourceWarehouseName;
    }

    public String getSourceWarehouseCode() {
        return sourceWarehouseCode;
    }

    public void setSourceWarehouseCode(String sourceWarehouseCode) {
        this.sourceWarehouseCode = sourceWarehouseCode;
    }

    public Long getDestinationWarehouseId() {
        return destinationWarehouseId;
    }

    public void setDestinationWarehouseId(Long destinationWarehouseId) {
        this.destinationWarehouseId = destinationWarehouseId;
    }

    public String getDestinationWarehouseName() {
        return destinationWarehouseName;
    }

    public void setDestinationWarehouseName(String destinationWarehouseName) {
        this.destinationWarehouseName = destinationWarehouseName;
    }

    public String getDestinationWarehouseCode() {
        return destinationWarehouseCode;
    }

    public void setDestinationWarehouseCode(String destinationWarehouseCode) {
        this.destinationWarehouseCode = destinationWarehouseCode;
    }

    public TransferStatus getStatus() {
        return status;
    }

    public void setStatus(TransferStatus status) {
        this.status = status;
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

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public List<TransferItemDto> getItems() {
        return items;
    }

    public void setItems(List<TransferItemDto> items) {
        this.items = items;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getApprovedAt() {
        return approvedAt;
    }

    public void setApprovedAt(LocalDateTime approvedAt) {
        this.approvedAt = approvedAt;
    }

    public LocalDateTime getConfirmedAt() {
        return confirmedAt;
    }

    public void setConfirmedAt(LocalDateTime confirmedAt) {
        this.confirmedAt = confirmedAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
