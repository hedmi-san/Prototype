package dz.company.distributor.sales.dto;

import java.math.BigDecimal;

public class SaleItemDto {
    private Long id;
    private Long productId;
    private String productReference;
    private String productName;
    private String productBrand;
    private String productUnit;
    private int quantity;
    private BigDecimal unitPrice;
    private BigDecimal subtotal;

    public SaleItemDto() {}

    public SaleItemDto(Long id, Long productId, String productReference, String productName, String productBrand, String productUnit, int quantity, BigDecimal unitPrice, BigDecimal subtotal) {
        this.id = id;
        this.productId = productId;
        this.productReference = productReference;
        this.productName = productName;
        this.productBrand = productBrand;
        this.productUnit = productUnit;
        this.quantity = quantity;
        this.unitPrice = unitPrice;
        this.subtotal = subtotal;
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

    public int getQuantity() {
        return quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(BigDecimal unitPrice) {
        this.unitPrice = unitPrice;
    }

    public BigDecimal getSubtotal() {
        return subtotal;
    }

    public void setSubtotal(BigDecimal subtotal) {
        this.subtotal = subtotal;
    }
}
