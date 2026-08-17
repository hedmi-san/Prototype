package dz.company.distributor.expenses;

import dz.company.distributor.audit.AuditService;
import dz.company.distributor.common.exception.ResourceNotFoundException;
import dz.company.distributor.expenses.dto.CreateExpenseRequest;
import dz.company.distributor.expenses.dto.ExpenseDto;
import dz.company.distributor.security.SecurityUtils;
import dz.company.distributor.users.User;
import dz.company.distributor.warehouses.Warehouse;
import dz.company.distributor.warehouses.WarehouseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final WarehouseRepository warehouseRepository;
    private final AuditService auditService;

    public ExpenseService(ExpenseRepository expenseRepository, WarehouseRepository warehouseRepository, AuditService auditService) {
        this.expenseRepository = expenseRepository;
        this.warehouseRepository = warehouseRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<ExpenseDto> getExpenses(Long warehouseId) {
        if (warehouseId != null && !SecurityUtils.isAdmin()) {
            SecurityUtils.validateWarehouseAccess(warehouseId);
        }
        List<Expense> expenses = (warehouseId != null)
                ? expenseRepository.findByWarehouseIdOrderByExpenseDateDesc(warehouseId)
                : expenseRepository.findAllByOrderByExpenseDateDesc();
        return expenses.stream().map(this::mapToDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ExpenseDto getExpenseById(Long id) {
        Expense expense = expenseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Expense not found with id: " + id));
        if (!SecurityUtils.isAdmin()) {
            SecurityUtils.validateWarehouseAccess(expense.getWarehouse().getId());
        }
        return mapToDto(expense);
    }

    @Transactional
    public ExpenseDto createExpense(CreateExpenseRequest request) {
        SecurityUtils.validateWarehouseAccess(request.getWarehouseId());

        Warehouse warehouse = warehouseRepository.findById(request.getWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found with id: " + request.getWarehouseId()));
        User currentUser = SecurityUtils.getCurrentUser();

        Expense expense = new Expense(
                warehouse,
                request.getCategory(),
                request.getAmount(),
                request.getDescription(),
                request.getExpenseDate(),
                currentUser
        );
        Expense saved = expenseRepository.save(expense);

        auditService.logAction(
                "EXPENSE_CREATED",
                "EXPENSE",
                saved.getId(),
                warehouse,
                null,
                request.getCategory() + ": " + request.getAmount() + " DZD",
                "Logged warehouse operating expense: " + request.getDescription()
        );

        return mapToDto(saved);
    }

    @Transactional
    public ExpenseDto updateExpense(Long id, CreateExpenseRequest request) {
        Expense expense = expenseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Expense not found with id: " + id));

        SecurityUtils.validateWarehouseAccess(expense.getWarehouse().getId());

        expense.setCategory(request.getCategory());
        expense.setAmount(request.getAmount());
        expense.setDescription(request.getDescription());
        expense.setExpenseDate(request.getExpenseDate());

        Expense saved = expenseRepository.save(expense);

        auditService.logAction(
                "EXPENSE_UPDATED",
                "EXPENSE",
                saved.getId(),
                saved.getWarehouse(),
                null,
                request.getCategory() + ": " + request.getAmount() + " DZD",
                "Updated operating expense #" + saved.getId()
        );

        return mapToDto(saved);
    }

    public ExpenseDto mapToDto(Expense expense) {
        return new ExpenseDto(
                expense.getId(),
                expense.getWarehouse().getId(),
                expense.getWarehouse().getName(),
                expense.getWarehouse().getCode(),
                expense.getCategory(),
                expense.getAmount(),
                expense.getDescription(),
                expense.getExpenseDate(),
                expense.getCreatedBy() != null ? expense.getCreatedBy().getId() : null,
                expense.getCreatedBy() != null ? expense.getCreatedBy().getFullName() : "Unknown",
                expense.getCreatedAt(),
                expense.getUpdatedAt()
        );
    }
}
