package dz.company.distributor.expenses.dto;

import dz.company.distributor.expenses.ExpenseCategory;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public class ExpenseDto {
    private Long id;
    private Long warehouseId;
    private String warehouseName;
    private String warehouseCode;
    private ExpenseCategory category;
    private BigDecimal amount;
    private String description;
    private LocalDate expenseDate;
    private Long createdById;
    private String createdByName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public ExpenseDto() {}

    public ExpenseDto(Long id, Long warehouseId, String warehouseName, String warehouseCode, ExpenseCategory category, BigDecimal amount, String description, LocalDate expenseDate, Long createdById, String createdByName, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.id = id;
        this.warehouseId = warehouseId;
        this.warehouseName = warehouseName;
        this.warehouseCode = warehouseCode;
        this.category = category;
        this.amount = amount;
        this.description = description;
        this.expenseDate = expenseDate;
        this.createdById = createdById;
        this.createdByName = createdByName;
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

    public ExpenseCategory getCategory() {
        return category;
    }

    public void setCategory(ExpenseCategory category) {
        this.category = category;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public LocalDate getExpenseDate() {
        return expenseDate;
    }

    public void setExpenseDate(LocalDate expenseDate) {
        this.expenseDate = expenseDate;
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
