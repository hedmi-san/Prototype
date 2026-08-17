package dz.company.distributor.sales.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public class UpdateSaleRequest {

    private String customerName;
    private String customerPhone;

    @NotEmpty(message = "Sale must contain at least one item")
    @Valid
    private List<SaleItemRequest> items;

    public UpdateSaleRequest() {}

    public UpdateSaleRequest(String customerName, String customerPhone, List<SaleItemRequest> items) {
        this.customerName = customerName;
        this.customerPhone = customerPhone;
        this.items = items;
    }

    public String getCustomerName() {
        return customerName;
    }

    public void setCustomerName(String customerName) {
        this.customerName = customerName;
    }

    public String getCustomerPhone() {
        return customerPhone;
    }

    public void setCustomerPhone(String customerPhone) {
        this.customerPhone = customerPhone;
    }

    public List<SaleItemRequest> getItems() {
        return items;
    }

    public void setItems(List<SaleItemRequest> items) {
        this.items = items;
    }
}
