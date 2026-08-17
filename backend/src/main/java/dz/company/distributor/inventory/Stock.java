package dz.company.distributor.inventory;

import dz.company.distributor.products.Product;
import dz.company.distributor.warehouses.Warehouse;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "stock", uniqueConstraints = {
    @UniqueConstraint(name = "uq_warehouse_product", columnNames = {"warehouse_id", "product_id"})
})
public class Stock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "warehouse_id", nullable = false)
    private Warehouse warehouse;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "physical_quantity", nullable = false)
    private int physicalQuantity = 0;

    @Column(name = "reserved_quantity", nullable = false)
    private int reservedQuantity = 0;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public Stock() {}

    public Stock(Warehouse warehouse, Product product, int physicalQuantity, int reservedQuantity) {
        this.warehouse = warehouse;
        this.product = product;
        this.physicalQuantity = physicalQuantity;
        this.reservedQuantity = reservedQuantity;
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public int getAvailableQuantity() {
        return Math.max(0, this.physicalQuantity - this.reservedQuantity);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Warehouse getWarehouse() {
        return warehouse;
    }

    public void setWarehouse(Warehouse warehouse) {
        this.warehouse = warehouse;
    }

    public Product getProduct() {
        return product;
    }

    public void setProduct(Product product) {
        this.product = product;
    }

    public int getPhysicalQuantity() {
        return physicalQuantity;
    }

    public void setPhysicalQuantity(int physicalQuantity) {
        this.physicalQuantity = physicalQuantity;
    }

    public int getReservedQuantity() {
        return reservedQuantity;
    }

    public void setReservedQuantity(int reservedQuantity) {
        this.reservedQuantity = reservedQuantity;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
