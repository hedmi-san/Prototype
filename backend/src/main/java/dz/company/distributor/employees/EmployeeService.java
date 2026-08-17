package dz.company.distributor.employees;

import dz.company.distributor.audit.AuditService;
import dz.company.distributor.common.exception.ResourceNotFoundException;
import dz.company.distributor.employees.dto.CreateEmployeeRequest;
import dz.company.distributor.employees.dto.EmployeeDto;
import dz.company.distributor.security.SecurityUtils;
import dz.company.distributor.warehouses.Warehouse;
import dz.company.distributor.warehouses.WarehouseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class EmployeeService {

    private final EmployeeRepository employeeRepository;
    private final WarehouseRepository warehouseRepository;
    private final AuditService auditService;

    public EmployeeService(EmployeeRepository employeeRepository, WarehouseRepository warehouseRepository, AuditService auditService) {
        this.employeeRepository = employeeRepository;
        this.warehouseRepository = warehouseRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<EmployeeDto> getEmployees(Long warehouseId) {
        if (warehouseId != null && !SecurityUtils.isAdmin()) {
            SecurityUtils.validateWarehouseAccess(warehouseId);
        }
        List<Employee> employees = (warehouseId != null)
                ? employeeRepository.findByWarehouseId(warehouseId)
                : employeeRepository.findAll();
        return employees.stream().map(this::mapToDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public EmployeeDto getEmployeeById(Long id) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + id));
        if (!SecurityUtils.isAdmin()) {
            SecurityUtils.validateWarehouseAccess(employee.getWarehouse().getId());
        }
        return mapToDto(employee);
    }

    @Transactional
    public EmployeeDto createEmployee(CreateEmployeeRequest request) {
        SecurityUtils.validateWarehouseAccess(request.getWarehouseId());

        Warehouse warehouse = warehouseRepository.findById(request.getWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found: " + request.getWarehouseId()));

        Employee employee = new Employee(
                warehouse,
                request.getFirstName(),
                request.getLastName(),
                request.getPosition(),
                request.getPhone(),
                request.getHireDate(),
                request.getMonthlySalary(),
                true
        );
        Employee saved = employeeRepository.save(employee);

        auditService.logAction(
                "EMPLOYEE_CREATED",
                "EMPLOYEE",
                saved.getId(),
                warehouse,
                null,
                saved.getFullName() + " (" + saved.getPosition() + ")",
                "Registered employee " + saved.getFullName()
        );

        return mapToDto(saved);
    }

    @Transactional
    public EmployeeDto updateEmployee(Long id, CreateEmployeeRequest request) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + id));

        SecurityUtils.validateWarehouseAccess(employee.getWarehouse().getId());

        employee.setFirstName(request.getFirstName());
        employee.setLastName(request.getLastName());
        employee.setPosition(request.getPosition());
        employee.setPhone(request.getPhone());
        employee.setHireDate(request.getHireDate());
        employee.setMonthlySalary(request.getMonthlySalary());

        Employee saved = employeeRepository.save(employee);

        auditService.logAction(
                "EMPLOYEE_UPDATED",
                "EMPLOYEE",
                saved.getId(),
                saved.getWarehouse(),
                null,
                saved.getFullName(),
                "Updated details for employee " + saved.getFullName()
        );

        return mapToDto(saved);
    }

    public EmployeeDto mapToDto(Employee employee) {
        return new EmployeeDto(
                employee.getId(),
                employee.getWarehouse().getId(),
                employee.getWarehouse().getName(),
                employee.getWarehouse().getCode(),
                employee.getFirstName(),
                employee.getLastName(),
                employee.getPosition(),
                employee.getPhone(),
                employee.getHireDate(),
                employee.getMonthlySalary(),
                employee.isActive(),
                employee.getCreatedAt(),
                employee.getUpdatedAt()
        );
    }
}
