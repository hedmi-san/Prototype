package dz.company.distributor.salaries.dto;

import dz.company.distributor.salaries.SalaryStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public class SalaryRecordDto {
    private Long id;
    private Long employeeId;
    private String employeeName;
    private String employeePosition;
    private Long warehouseId;
    private String warehouseName;
    private String warehouseCode;
    private String period;
    private BigDecimal baseSalary;
    private BigDecimal bonus1;
    private BigDecimal bonus2;
    private BigDecimal totalAmount;
    private LocalDate paymentDate;
    private SalaryStatus status;
    private Long createdById;
    private String createdByName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public SalaryRecordDto() {}

    public SalaryRecordDto(Long id, Long employeeId, String employeeName, String employeePosition, Long warehouseId, String warehouseName, String warehouseCode, String period, BigDecimal baseSalary, BigDecimal bonus1, BigDecimal bonus2, BigDecimal totalAmount, LocalDate paymentDate, SalaryStatus status, Long createdById, String createdByName, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.id = id;
        this.employeeId = employeeId;
        this.employeeName = employeeName;
        this.employeePosition = employeePosition;
        this.warehouseId = warehouseId;
        this.warehouseName = warehouseName;
        this.warehouseCode = warehouseCode;
        this.period = period;
        this.baseSalary = baseSalary;
        this.bonus1 = bonus1;
        this.bonus2 = bonus2;
        this.totalAmount = totalAmount;
        this.paymentDate = paymentDate;
        this.status = status;
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

    public Long getEmployeeId() {
        return employeeId;
    }

    public void setEmployeeId(Long employeeId) {
        this.employeeId = employeeId;
    }

    public String getEmployeeName() {
        return employeeName;
    }

    public void setEmployeeName(String employeeName) {
        this.employeeName = employeeName;
    }

    public String getEmployeePosition() {
        return employeePosition;
    }

    public void setEmployeePosition(String employeePosition) {
        this.employeePosition = employeePosition;
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

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    public LocalDate getPaymentDate() {
        return paymentDate;
    }

    public void setPaymentDate(LocalDate paymentDate) {
        this.paymentDate = paymentDate;
    }

    public SalaryStatus getStatus() {
        return status;
    }

    public void setStatus(SalaryStatus status) {
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
