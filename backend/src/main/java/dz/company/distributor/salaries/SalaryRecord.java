package dz.company.distributor.salaries;

import dz.company.distributor.employees.Employee;
import dz.company.distributor.users.User;
import dz.company.distributor.warehouses.Warehouse;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "salary_records", uniqueConstraints = {
    @UniqueConstraint(name = "uq_employee_period", columnNames = {"employee_id", "period"})
})
public class SalaryRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "warehouse_id", nullable = false)
    private Warehouse warehouse;

    @Column(nullable = false, length = 7)
    private String period; // YYYY-MM

    @Column(name = "base_salary", nullable = false, precision = 12, scale = 2)
    private BigDecimal baseSalary;

    @Column(name = "bonus_1", nullable = false, precision = 12, scale = 2)
    private BigDecimal bonus1 = BigDecimal.ZERO;

    @Column(name = "bonus_2", nullable = false, precision = 12, scale = 2)
    private BigDecimal bonus2 = BigDecimal.ZERO;

    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "payment_date", nullable = false)
    private LocalDate paymentDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SalaryStatus status = SalaryStatus.PAID;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public SalaryRecord() {}

    public SalaryRecord(Employee employee, Warehouse warehouse, String period, BigDecimal baseSalary, BigDecimal bonus1, BigDecimal bonus2, BigDecimal totalAmount, LocalDate paymentDate, SalaryStatus status, User createdBy) {
        this.employee = employee;
        this.warehouse = warehouse;
        this.period = period;
        this.baseSalary = baseSalary;
        this.bonus1 = bonus1 != null ? bonus1 : BigDecimal.ZERO;
        this.bonus2 = bonus2 != null ? bonus2 : BigDecimal.ZERO;
        this.totalAmount = totalAmount;
        this.paymentDate = paymentDate != null ? paymentDate : LocalDate.now();
        this.status = status != null ? status : SalaryStatus.PAID;
        this.createdBy = createdBy;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Employee getEmployee() {
        return employee;
    }

    public void setEmployee(Employee employee) {
        this.employee = employee;
    }

    public Warehouse getWarehouse() {
        return warehouse;
    }

    public void setWarehouse(Warehouse warehouse) {
        this.warehouse = warehouse;
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

    public User getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(User createdBy) {
        this.createdBy = createdBy;
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
