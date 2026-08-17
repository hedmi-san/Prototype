package dz.company.distributor.transfers;

import dz.company.distributor.products.Product;
import jakarta.persistence.*;

@Entity
@Table(name = "transfer_items")
public class TransferItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transfer_id", nullable = false)
    private Transfer transfer;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "requested_quantity", nullable = false)
    private int requestedQuantity;

    @Column(name = "approved_quantity", nullable = false)
    private int approvedQuantity = 0;

    public TransferItem() {}

    public TransferItem(Transfer transfer, Product product, int requestedQuantity, int approvedQuantity) {
        this.transfer = transfer;
        this.product = product;
        this.requestedQuantity = requestedQuantity;
        this.approvedQuantity = approvedQuantity;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Transfer getTransfer() {
        return transfer;
    }

    public void setTransfer(Transfer transfer) {
        this.transfer = transfer;
    }

    public Product getProduct() {
        return product;
    }

    public void setProduct(Product product) {
        this.product = product;
    }

    public int getRequestedQuantity() {
        return requestedQuantity;
    }

    public void setRequestedQuantity(int requestedQuantity) {
        this.requestedQuantity = requestedQuantity;
    }

    public int getApprovedQuantity() {
        return approvedQuantity;
    }

    public void setApprovedQuantity(int approvedQuantity) {
        this.approvedQuantity = approvedQuantity;
    }
}
