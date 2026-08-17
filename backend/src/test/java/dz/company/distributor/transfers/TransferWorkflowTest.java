package dz.company.distributor.transfers;

import dz.company.distributor.inventory.Stock;
import dz.company.distributor.inventory.StockRepository;
import dz.company.distributor.products.Product;
import dz.company.distributor.products.ProductRepository;
import dz.company.distributor.security.CustomUserDetails;
import dz.company.distributor.transfers.dto.*;
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
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("dev")
@Transactional
public class TransferWorkflowTest {

    @Autowired
    private TransferService transferService;

    @Autowired
    private StockRepository stockRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private WarehouseRepository warehouseRepository;

    @Autowired
    private UserRepository userRepository;

    private Warehouse warehouseSource;
    private Warehouse warehouseDest;
    private Product product;
    private User managerSource;
    private User managerDest;

    @BeforeEach
    public void setup() {
        List<Warehouse> warehouses = warehouseRepository.findAll();
        warehouseSource = warehouses.get(0); // Algiers
        warehouseDest = warehouses.get(1);   // Oran

        managerSource = userRepository.findByUsername("manager_algiers").orElseThrow();
        managerDest = userRepository.findByUsername("manager_oran").orElseThrow();

        product = productRepository.save(new Product(
                "TEST-TRF-" + System.currentTimeMillis(),
                "Transfer Test Hammer",
                "KRAFT",
                new BigDecimal("4000.00"),
                new BigDecimal("6000.00"),
                "PIECE",
                true
        ));

        // Source has 10 units, Dest has 2 units
        stockRepository.save(new Stock(warehouseSource, product, 10, 0));
        stockRepository.save(new Stock(warehouseDest, product, 2, 0));
    }

    private void authenticateAs(User user) {
        CustomUserDetails userDetails = new CustomUserDetails(user);
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    @DisplayName("Complete Transfer workflow: Request -> Approval & Reservation -> Reception Confirmation & Stock Transfer")
    public void testCompleteTransferWorkflow() {
        // 1. Destination Manager requests 7 units
        authenticateAs(managerDest);
        CreateTransferRequest createReq = new CreateTransferRequest(
                warehouseSource.getId(),
                warehouseDest.getId(),
                "Need 7 units for Oran store",
                List.of(new TransferItemRequest(product.getId(), 7))
        );
        TransferDto created = transferService.createTransfer(createReq);
        assertEquals(TransferStatus.REQUESTED, created.getStatus());

        // 2. Source Manager approves 5 units (partial fulfillment) -> Must reserve 5 units at source
        authenticateAs(managerSource);
        ApproveTransferRequest approveReq = new ApproveTransferRequest(
                List.of(new ApprovedItemRequest(product.getId(), 5))
        );
        TransferDto approved = transferService.approveTransfer(created.getId(), approveReq);
        assertEquals(TransferStatus.APPROVED, approved.getStatus());

        Stock sourceStock = stockRepository.findByWarehouseIdAndProductId(warehouseSource.getId(), product.getId()).orElseThrow();
        assertEquals(10, sourceStock.getPhysicalQuantity(), "Source physical stock should still be 10 before confirmation");
        assertEquals(5, sourceStock.getReservedQuantity(), "Source reserved stock should be 5");
        assertEquals(5, sourceStock.getAvailableQuantity(), "Source available stock should be 10 - 5 = 5");

        // 3. Destination Manager confirms reception -> 5 units move from Source to Dest
        authenticateAs(managerDest);
        TransferDto confirmed = transferService.confirmTransfer(created.getId());
        assertEquals(TransferStatus.CONFIRMED, confirmed.getStatus());

        sourceStock = stockRepository.findByWarehouseIdAndProductId(warehouseSource.getId(), product.getId()).orElseThrow();
        Stock destStock = stockRepository.findByWarehouseIdAndProductId(warehouseDest.getId(), product.getId()).orElseThrow();

        assertEquals(5, sourceStock.getPhysicalQuantity(), "Source physical stock should now be 10 - 5 = 5");
        assertEquals(0, sourceStock.getReservedQuantity(), "Source reserved stock should now be 0");
        assertEquals(7, destStock.getPhysicalQuantity(), "Destination physical stock should now be 2 + 5 = 7");
    }

    @Test
    @DisplayName("Cancelling an approved transfer releases reserved stock back to available stock")
    public void testTransferCancellationReleasesReservation() {
        // 1. Destination requests
        authenticateAs(managerDest);
        CreateTransferRequest createReq = new CreateTransferRequest(
                warehouseSource.getId(),
                warehouseDest.getId(),
                "Stock request",
                List.of(new TransferItemRequest(product.getId(), 4))
        );
        TransferDto created = transferService.createTransfer(createReq);

        // 2. Source approves 4 -> reserves 4
        authenticateAs(managerSource);
        transferService.approveTransfer(created.getId(), new ApproveTransferRequest(List.of(new ApprovedItemRequest(product.getId(), 4))));

        Stock sourceStock = stockRepository.findByWarehouseIdAndProductId(warehouseSource.getId(), product.getId()).orElseThrow();
        assertEquals(4, sourceStock.getReservedQuantity());

        // 3. Destination cancels before confirming
        authenticateAs(managerDest);
        TransferDto cancelled = transferService.cancelTransfer(created.getId());
        assertEquals(TransferStatus.CANCELLED, cancelled.getStatus());

        sourceStock = stockRepository.findByWarehouseIdAndProductId(warehouseSource.getId(), product.getId()).orElseThrow();
        assertEquals(0, sourceStock.getReservedQuantity(), "Reserved quantity should be released back to 0");
        assertEquals(10, sourceStock.getAvailableQuantity(), "Available quantity should be fully restored to 10");
    }
}
