package dz.company.distributor.transfers;

import dz.company.distributor.users.User;
import dz.company.distributor.warehouses.Warehouse;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "transfers")
public class Transfer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "source_warehouse_id", nullable = false)
    private Warehouse sourceWarehouse;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "destination_warehouse_id", nullable = false)
    private Warehouse destinationWarehouse;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TransferStatus status = TransferStatus.REQUESTED;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Column(length = 255)
    private String notes;

    @OneToMany(mappedBy = "transfer", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TransferItem> items = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public Transfer() {}

    public Transfer(Warehouse sourceWarehouse, Warehouse destinationWarehouse, TransferStatus status, User createdBy, String notes) {
        this.sourceWarehouse = sourceWarehouse;
        this.destinationWarehouse = destinationWarehouse;
        this.status = status != null ? status : TransferStatus.REQUESTED;
        this.createdBy = createdBy;
        this.notes = notes;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public void addItem(TransferItem item) {
        items.add(item);
        item.setTransfer(this);
    }

    public void removeItem(TransferItem item) {
        items.remove(item);
        item.setTransfer(null);
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

    public Warehouse getSourceWarehouse() {
        return sourceWarehouse;
    }

    public void setSourceWarehouse(Warehouse sourceWarehouse) {
        this.sourceWarehouse = sourceWarehouse;
    }

    public Warehouse getDestinationWarehouse() {
        return destinationWarehouse;
    }

    public void setDestinationWarehouse(Warehouse destinationWarehouse) {
        this.destinationWarehouse = destinationWarehouse;
    }

    public TransferStatus getStatus() {
        return status;
    }

    public void setStatus(TransferStatus status) {
        this.status = status;
    }

    public User getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(User createdBy) {
        this.createdBy = createdBy;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public List<TransferItem> getItems() {
        return items;
    }

    public void setItems(List<TransferItem> items) {
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
