package dz.company.distributor.products.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public class ProductPriceUpdateRequest {

    @NotNull(message = "Purchase price is required")
    @DecimalMin(value = "0.0", inclusive = true, message = "Purchase price must be positive")
    private BigDecimal purchasePrice;

    @NotNull(message = "Sale price is required")
    @DecimalMin(value = "0.0", inclusive = true, message = "Sale price must be positive")
    private BigDecimal salePrice;

    public ProductPriceUpdateRequest() {}

    public ProductPriceUpdateRequest(BigDecimal purchasePrice, BigDecimal salePrice) {
        this.purchasePrice = purchasePrice;
        this.salePrice = salePrice;
    }

    public BigDecimal getPurchasePrice() {
        return purchasePrice;
    }

    public void setPurchasePrice(BigDecimal purchasePrice) {
        this.purchasePrice = purchasePrice;
    }

    public BigDecimal getSalePrice() {
        return salePrice;
    }

    public void setSalePrice(BigDecimal salePrice) {
        this.salePrice = salePrice;
    }
}
