package dz.company.distributor.sales;

import dz.company.distributor.inventory.Stock;
import dz.company.distributor.inventory.StockRepository;
import dz.company.distributor.products.Product;
import dz.company.distributor.products.ProductRepository;
import dz.company.distributor.sales.dto.*;
import dz.company.distributor.security.CustomUserDetails;
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
public class SaleModificationTest {

    @Autowired
    private SaleService saleService;

    @Autowired
    private StockRepository stockRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private WarehouseRepository warehouseRepository;

    @Autowired
    private UserRepository userRepository;

    private Warehouse warehouse;
    private Product productA;
    private Product productB;
    private User accountant;

    @BeforeEach
    public void setup() {
        warehouse = warehouseRepository.findAll().get(0);
        accountant = userRepository.findByUsername("accountant_algiers").orElseThrow();

        // Setup security context
        CustomUserDetails userDetails = new CustomUserDetails(accountant);
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);

        productA = productRepository.save(new Product(
                "TEST-PRD-A-" + System.currentTimeMillis(),
                "Product Alpha",
                "KRAFT",
                new BigDecimal("5000.00"),
                new BigDecimal("8000.00"),
                "PIECE",
                true
        ));

        productB = productRepository.save(new Product(
                "TEST-PRD-B-" + System.currentTimeMillis(),
                "Product Beta",
                "KRAFT",
                new BigDecimal("3000.00"),
                new BigDecimal("4500.00"),
                "PIECE",
                true
        ));

        stockRepository.save(new Stock(warehouse, productA, 20, 0));
        stockRepository.save(new Stock(warehouse, productB, 15, 0));
    }

    @Test
    @DisplayName("Sale editing correctly reconciles stock deltas and sale cancellation restores all items")
    public void testSaleLifecycleAndDeltaReconciliation() {
        // 1. Create Sale (5 Alpha, 3 Beta)
        CreateSaleRequest createReq = new CreateSaleRequest(
                warehouse.getId(),
                "Client Test SARL",
                "+213 550 00 11 22",
                List.of(
                        new SaleItemRequest(productA.getId(), 5),
                        new SaleItemRequest(productB.getId(), 3)
                )
        );

        SaleDto created = saleService.createSale(createReq);
        assertNotNull(created.getId());
        assertEquals(new BigDecimal("53500.00"), created.getTotalAmount()); // 5*8000 + 3*4500 = 40000 + 13500

        Stock stockA = stockRepository.findByWarehouseIdAndProductId(warehouse.getId(), productA.getId()).orElseThrow();
        Stock stockB = stockRepository.findByWarehouseIdAndProductId(warehouse.getId(), productB.getId()).orElseThrow();
        assertEquals(15, stockA.getPhysicalQuantity(), "Product A stock should decrease from 20 to 15");
        assertEquals(12, stockB.getPhysicalQuantity(), "Product B stock should decrease from 15 to 12");

        // 2. Edit Sale: Increase Alpha from 5 -> 8 (delta +3), Decrease Beta from 3 -> 1 (delta -2)
        UpdateSaleRequest updateReq = new UpdateSaleRequest(
                "Client Test SARL Updated",
                "+213 550 00 11 22",
                List.of(
                        new SaleItemRequest(productA.getId(), 8),
                        new SaleItemRequest(productB.getId(), 1)
                )
        );

        SaleDto updated = saleService.updateSale(created.getId(), updateReq);
        assertEquals(new BigDecimal("68500.00"), updated.getTotalAmount()); // 8*8000 + 1*4500 = 64000 + 4500

        stockA = stockRepository.findByWarehouseIdAndProductId(warehouse.getId(), productA.getId()).orElseThrow();
        stockB = stockRepository.findByWarehouseIdAndProductId(warehouse.getId(), productB.getId()).orElseThrow();
        assertEquals(12, stockA.getPhysicalQuantity(), "Product A stock should decrease further by 3 (15 - 3 = 12)");
        assertEquals(14, stockB.getPhysicalQuantity(), "Product B stock should increase by 2 (12 + 2 = 14)");

        // 3. Cancel Sale -> All stock must be returned
        SaleDto cancelled = saleService.cancelSale(created.getId());
        assertEquals(SaleStatus.CANCELLED, cancelled.getStatus());

        stockA = stockRepository.findByWarehouseIdAndProductId(warehouse.getId(), productA.getId()).orElseThrow();
        stockB = stockRepository.findByWarehouseIdAndProductId(warehouse.getId(), productB.getId()).orElseThrow();
        assertEquals(20, stockA.getPhysicalQuantity(), "Product A stock must be fully restored to 20");
        assertEquals(15, stockB.getPhysicalQuantity(), "Product B stock must be fully restored to 15");
    }
}
