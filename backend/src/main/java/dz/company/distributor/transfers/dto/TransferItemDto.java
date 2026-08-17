package dz.company.distributor.transfers.dto;

public class TransferItemDto {
    private Long id;
    private Long productId;
    private String productReference;
    private String productName;
    private String productBrand;
    private String productUnit;
    private int requestedQuantity;
    private int approvedQuantity;

    public TransferItemDto() {}

    public TransferItemDto(Long id, Long productId, String productReference, String productName, String productBrand, String productUnit, int requestedQuantity, int approvedQuantity) {
        this.id = id;
        this.productId = productId;
        this.productReference = productReference;
        this.productName = productName;
        this.productBrand = productBrand;
        this.productUnit = productUnit;
        this.requestedQuantity = requestedQuantity;
        this.approvedQuantity = approvedQuantity;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getProductId() {
        return productId;
    }

    public void setProductId(Long productId) {
        this.productId = productId;
    }

    public String getProductReference() {
        return productReference;
    }

    public void setProductReference(String productReference) {
        this.productReference = productReference;
    }

    public String getProductName() {
        return productName;
    }

    public void setProductName(String productName) {
        this.productName = productName;
    }

    public String getProductBrand() {
        return productBrand;
    }

    public void setProductBrand(String productBrand) {
        this.productBrand = productBrand;
    }

    public String getProductUnit() {
        return productUnit;
    }

    public void setProductUnit(String productUnit) {
        this.productUnit = productUnit;
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
