package dz.company.distributor.security;

import dz.company.distributor.common.exception.UnauthorizedAccessException;
import dz.company.distributor.expenses.ExpenseService;
import dz.company.distributor.expenses.dto.CreateExpenseRequest;
import dz.company.distributor.expenses.ExpenseCategory;
import dz.company.distributor.inventory.InventoryService;
import dz.company.distributor.inventory.dto.StockDto;
import dz.company.distributor.users.User;
import dz.company.distributor.users.UserRepository;
import dz.company.distributor.warehouses.Warehouse;
import dz.company.distributor.warehouses.WarehouseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("dev")
@Transactional
public class AuthorizationTest {

    @Autowired
    private ExpenseService expenseService;

    @Autowired
    private InventoryService inventoryService;

    @Autowired
    private WarehouseRepository warehouseRepository;

    @Autowired
    private UserRepository userRepository;

    private Warehouse warehouse1;
    private Warehouse warehouse2;
    private User managerWarehouse1;
    private User superManagerWarehouse2;
    private User admin;

    @BeforeEach
    public void setup() {
        List<Warehouse> warehouses = warehouseRepository.findAll();
        warehouse1 = warehouses.get(0);
        warehouse2 = warehouses.get(1);

        managerWarehouse1 = userRepository.findByUsername("manager_algiers").orElseThrow();
        superManagerWarehouse2 = userRepository.findByUsername("super_oran").orElseThrow();
        admin = userRepository.findByUsername("admin").orElseThrow();
    }

    private void authenticateAs(User user) {
        CustomUserDetails userDetails = new CustomUserDetails(user);
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    @DisplayName("Manager of Warehouse 1 cannot create expenses for Warehouse 2")
    public void testWarehouseDataIsolation() {
        authenticateAs(managerWarehouse1);

        CreateExpenseRequest request = new CreateExpenseRequest(
                warehouse2.getId(), // Cross-warehouse target
                ExpenseCategory.FUEL,
                new BigDecimal("5000.00"),
                "Unauthorized cross-warehouse expense attempt",
                LocalDate.now()
        );

        assertThrows(UnauthorizedAccessException.class, () -> {
            expenseService.createExpense(request);
        });
    }

    @Test
    @DisplayName("Super Manager can view stock in another warehouse")
    public void testSuperManagerCrossWarehouseStockRead() {
        authenticateAs(superManagerWarehouse2);

        // Super manager of Warehouse 2 reading Warehouse 1 stock
        List<StockDto> stockList = inventoryService.getStockByWarehouse(warehouse1.getId());
        assertNotNull(stockList);
        assertFalse(stockList.isEmpty());
    }

    @Test
    @DisplayName("Admin has global access across all warehouses")
    public void testAdminGlobalAccess() {
        authenticateAs(admin);

        CreateExpenseRequest request = new CreateExpenseRequest(
                warehouse1.getId(),
                ExpenseCategory.MAINTENANCE,
                new BigDecimal("8000.00"),
                "Admin approved maintenance",
                LocalDate.now()
        );

        assertDoesNotThrow(() -> {
            expenseService.createExpense(request);
        });
    }
}
