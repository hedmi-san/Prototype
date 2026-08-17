package dz.company.distributor.expenses.dto;

import dz.company.distributor.expenses.ExpenseCategory;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public class CreateExpenseRequest {

    @NotNull(message = "Warehouse ID is required")
    private Long warehouseId;

    @NotNull(message = "Expense category is required")
    private ExpenseCategory category;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.01", message = "Amount must be strictly greater than 0")
    private BigDecimal amount;

    @NotBlank(message = "Description is required")
    private String description;

    @NotNull(message = "Expense date is required")
    private LocalDate expenseDate;

    public CreateExpenseRequest() {}

    public CreateExpenseRequest(Long warehouseId, ExpenseCategory category, BigDecimal amount, String description, LocalDate expenseDate) {
        this.warehouseId = warehouseId;
        this.category = category;
        this.amount = amount;
        this.description = description;
        this.expenseDate = expenseDate;
    }

    public Long getWarehouseId() {
        return warehouseId;
    }

    public void setWarehouseId(Long warehouseId) {
        this.warehouseId = warehouseId;
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
}
