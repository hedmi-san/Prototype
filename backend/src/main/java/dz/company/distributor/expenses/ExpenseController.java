package dz.company.distributor.expenses;

import dz.company.distributor.common.response.ApiResponse;
import dz.company.distributor.expenses.dto.CreateExpenseRequest;
import dz.company.distributor.expenses.dto.ExpenseDto;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/expenses")
public class ExpenseController {

    private final ExpenseService expenseService;

    public ExpenseController(ExpenseService expenseService) {
        this.expenseService = expenseService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ExpenseDto>>> getExpenses(@RequestParam(required = false) Long warehouseId) {
        List<ExpenseDto> expenses = expenseService.getExpenses(warehouseId);
        return ResponseEntity.ok(ApiResponse.success(expenses));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ExpenseDto>> getExpenseById(@PathVariable Long id) {
        ExpenseDto expense = expenseService.getExpenseById(id);
        return ResponseEntity.ok(ApiResponse.success(expense));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<ExpenseDto>> createExpense(@Valid @RequestBody CreateExpenseRequest request) {
        ExpenseDto created = expenseService.createExpense(request);
        return ResponseEntity.ok(ApiResponse.success("Expense recorded successfully", created));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<ExpenseDto>> updateExpense(@PathVariable Long id,
            @Valid @RequestBody CreateExpenseRequest request) {
        ExpenseDto updated = expenseService.updateExpense(id, request);
        return ResponseEntity.ok(ApiResponse.success("Expense updated successfully", updated));
    }
}
