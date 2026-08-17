package dz.company.distributor.salaries;

import dz.company.distributor.audit.AuditService;
import dz.company.distributor.common.exception.BusinessException;
import dz.company.distributor.common.exception.ResourceNotFoundException;
import dz.company.distributor.employees.Employee;
import dz.company.distributor.employees.EmployeeRepository;
import dz.company.distributor.salaries.dto.CreateSalaryRequest;
import dz.company.distributor.salaries.dto.SalaryRecordDto;
import dz.company.distributor.security.SecurityUtils;
import dz.company.distributor.users.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class SalaryService {

    private final SalaryRepository salaryRepository;
    private final EmployeeRepository employeeRepository;
    private final AuditService auditService;

    public SalaryService(SalaryRepository salaryRepository, EmployeeRepository employeeRepository, AuditService auditService) {
        this.salaryRepository = salaryRepository;
        this.employeeRepository = employeeRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<SalaryRecordDto> getSalaries(Long warehouseId) {
        if (warehouseId != null && !SecurityUtils.isAdmin()) {
            SecurityUtils.validateWarehouseAccess(warehouseId);
        }
        List<SalaryRecord> salaries = (warehouseId != null)
                ? salaryRepository.findByWarehouseIdOrderByPeriodDesc(warehouseId)
                : salaryRepository.findAllByOrderByPeriodDesc();
        return salaries.stream().map(this::mapToDto).collect(Collectors.toList());
    }

    @Transactional
    public SalaryRecordDto recordSalary(CreateSalaryRequest request) {
        Employee employee = employeeRepository.findById(request.getEmployeeId())
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + request.getEmployeeId()));

        SecurityUtils.validateWarehouseAccess(employee.getWarehouse().getId());

        if (salaryRepository.findByEmployeeIdAndPeriod(employee.getId(), request.getPeriod()).isPresent()) {
            throw new BusinessException("Salary record already exists for employee " + employee.getFullName() + " in period " + request.getPeriod());
        }

        BigDecimal b1 = request.getBonus1() != null ? request.getBonus1() : BigDecimal.ZERO;
        BigDecimal b2 = request.getBonus2() != null ? request.getBonus2() : BigDecimal.ZERO;
        BigDecimal total = request.getBaseSalary().add(b1).add(b2);

        User currentUser = SecurityUtils.getCurrentUser();

        SalaryRecord salaryRecord = new SalaryRecord(
                employee,
                employee.getWarehouse(),
                request.getPeriod(),
                request.getBaseSalary(),
                b1,
                b2,
                total,
                request.getPaymentDate(),
                SalaryStatus.PAID,
                currentUser
        );
        SalaryRecord saved = salaryRepository.save(salaryRecord);

        auditService.logAction(
                "SALARY_RECORDED",
                "SALARY",
                saved.getId(),
                employee.getWarehouse(),
                null,
                "Period: " + saved.getPeriod() + ", Total: " + total + " DZD",
                "Disbursed salary for " + employee.getFullName() + " for period " + saved.getPeriod()
        );

        return mapToDto(saved);
    }

    public SalaryRecordDto mapToDto(SalaryRecord record) {
        return new SalaryRecordDto(
                record.getId(),
                record.getEmployee().getId(),
                record.getEmployee().getFullName(),
                record.getEmployee().getPosition(),
                record.getWarehouse().getId(),
                record.getWarehouse().getName(),
                record.getWarehouse().getCode(),
                record.getPeriod(),
                record.getBaseSalary(),
                record.getBonus1(),
                record.getBonus2(),
                record.getTotalAmount(),
                record.getPaymentDate(),
                record.getStatus(),
                record.getCreatedBy() != null ? record.getCreatedBy().getId() : null,
                record.getCreatedBy() != null ? record.getCreatedBy().getFullName() : "Unknown",
                record.getCreatedAt(),
                record.getUpdatedAt()
        );
    }
}
