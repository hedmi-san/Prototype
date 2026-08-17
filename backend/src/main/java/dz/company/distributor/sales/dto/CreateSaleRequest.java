package dz.company.distributor.sales.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public class CreateSaleRequest {

    @NotNull(message = "Warehouse ID is required")
    private Long warehouseId;

    private String customerName;
    private String customerPhone;

    @NotEmpty(message = "Sale must contain at least one item")
    @Valid
    private List<SaleItemRequest> items;

    public CreateSaleRequest() {}

    public CreateSaleRequest(Long warehouseId, String customerName, String customerPhone, List<SaleItemRequest> items) {
        this.warehouseId = warehouseId;
        this.customerName = customerName;
        this.customerPhone = customerPhone;
        this.items = items;
    }

    public Long getWarehouseId() {
        return warehouseId;
    }

    public void setWarehouseId(Long warehouseId) {
        this.warehouseId = warehouseId;
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
