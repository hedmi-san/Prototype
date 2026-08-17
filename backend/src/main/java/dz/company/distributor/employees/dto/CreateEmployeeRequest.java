package dz.company.distributor.employees.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public class CreateEmployeeRequest {

    @NotNull(message = "Warehouse ID is required")
    private Long warehouseId;

    @NotBlank(message = "First name is required")
    private String firstName;

    @NotBlank(message = "Last name is required")
    private String lastName;

    @NotBlank(message = "Position is required")
    private String position;

    private String phone;

    @NotNull(message = "Hire date is required")
    private LocalDate hireDate;

    @NotNull(message = "Monthly base salary is required")
    @DecimalMin(value = "0.0", message = "Salary must be non-negative")
    private BigDecimal monthlySalary;

    public CreateEmployeeRequest() {}

    public CreateEmployeeRequest(Long warehouseId, String firstName, String lastName, String position, String phone, LocalDate hireDate, BigDecimal monthlySalary) {
        this.warehouseId = warehouseId;
        this.firstName = firstName;
        this.lastName = lastName;
        this.position = position;
        this.phone = phone;
        this.hireDate = hireDate;
        this.monthlySalary = monthlySalary;
    }

    public Long getWarehouseId() {
        return warehouseId;
    }

    public void setWarehouseId(Long warehouseId) {
        this.warehouseId = warehouseId;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public String getPosition() {
        return position;
    }

    public void setPosition(String position) {
        this.position = position;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public LocalDate getHireDate() {
        return hireDate;
    }

    public void setHireDate(LocalDate hireDate) {
        this.hireDate = hireDate;
    }

    public BigDecimal getMonthlySalary() {
        return monthlySalary;
    }

    public void setMonthlySalary(BigDecimal monthlySalary) {
        this.monthlySalary = monthlySalary;
    }
}
