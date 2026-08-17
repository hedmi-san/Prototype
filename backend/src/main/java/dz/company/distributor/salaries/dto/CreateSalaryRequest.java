package dz.company.distributor.salaries.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public class CreateSalaryRequest {

    @NotNull(message = "Employee ID is required")
    private Long employeeId;

    @NotBlank(message = "Period is required (YYYY-MM)")
    private String period;

    @NotNull(message = "Base salary is required")
    @DecimalMin(value = "0.0", message = "Base salary must be non-negative")
    private BigDecimal baseSalary;

    private BigDecimal bonus1;
    private BigDecimal bonus2;

    @NotNull(message = "Payment date is required")
    private LocalDate paymentDate;

    public CreateSalaryRequest() {}

    public CreateSalaryRequest(Long employeeId, String period, BigDecimal baseSalary, BigDecimal bonus1, BigDecimal bonus2, LocalDate paymentDate) {
        this.employeeId = employeeId;
        this.period = period;
        this.baseSalary = baseSalary;
        this.bonus1 = bonus1;
        this.bonus2 = bonus2;
        this.paymentDate = paymentDate;
    }

    public Long getEmployeeId() {
        return employeeId;
    }

    public void setEmployeeId(Long employeeId) {
        this.employeeId = employeeId;
    }

    public String getPeriod() {
        return period;
    }

    public void setPeriod(String period) {
        this.period = period;
    }

    public BigDecimal getBaseSalary() {
        return baseSalary;
    }

    public void setBaseSalary(BigDecimal baseSalary) {
        this.baseSalary = baseSalary;
    }

    public BigDecimal getBonus1() {
        return bonus1;
    }

    public void setBonus1(BigDecimal bonus1) {
        this.bonus1 = bonus1;
    }

    public BigDecimal getBonus2() {
        return bonus2;
    }

    public void setBonus2(BigDecimal bonus2) {
        this.bonus2 = bonus2;
    }

    public LocalDate getPaymentDate() {
        return paymentDate;
    }

    public void setPaymentDate(LocalDate paymentDate) {
        this.paymentDate = paymentDate;
    }
}
