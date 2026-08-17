package dz.company.distributor.sales.dto;

import dz.company.distributor.sales.SaleStatus;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class SaleDto {
    private Long id;
    private Long warehouseId;
    private String warehouseName;
    private String warehouseCode;
    private String invoiceNumber;
    private String customerName;
    private String customerPhone;
    private BigDecimal totalAmount;
    private LocalDateTime saleDate;
    private SaleStatus status;
    private Long createdById;
    private String createdByName;
    private List<SaleItemDto> items;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public SaleDto() {}

    public SaleDto(Long id, Long warehouseId, String warehouseName, String warehouseCode, String invoiceNumber, String customerName, String customerPhone, BigDecimal totalAmount, LocalDateTime saleDate, SaleStatus status, Long createdById, String createdByName, List<SaleItemDto> items, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.id = id;
        this.warehouseId = warehouseId;
        this.warehouseName = warehouseName;
        this.warehouseCode = warehouseCode;
        this.invoiceNumber = invoiceNumber;
        this.customerName = customerName;
        this.customerPhone = customerPhone;
        this.totalAmount = totalAmount;
        this.saleDate = saleDate;
        this.status = status;
        this.createdById = createdById;
        this.createdByName = createdByName;
        this.items = items;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getWarehouseId() {
        return warehouseId;
    }

    public void setWarehouseId(Long warehouseId) {
        this.warehouseId = warehouseId;
    }

    public String getWarehouseName() {
        return warehouseName;
    }

    public void setWarehouseName(String warehouseName) {
        this.warehouseName = warehouseName;
    }

    public String getWarehouseCode() {
        return warehouseCode;
    }

    public void setWarehouseCode(String warehouseCode) {
        this.warehouseCode = warehouseCode;
    }

    public String getInvoiceNumber() {
        return invoiceNumber;
    }

    public void setInvoiceNumber(String invoiceNumber) {
        this.invoiceNumber = invoiceNumber;
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

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    public LocalDateTime getSaleDate() {
        return saleDate;
    }

    public void setSaleDate(LocalDateTime saleDate) {
        this.saleDate = saleDate;
    }

    public SaleStatus getStatus() {
        return status;
    }

    public void setStatus(SaleStatus status) {
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

    public List<SaleItemDto> getItems() {
        return items;
    }

    public void setItems(List<SaleItemDto> items) {
        this.items = items;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
