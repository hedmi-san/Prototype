package dz.company.distributor.common.exception;

public class InsufficientStockException extends RuntimeException {
    private final String productReference;
    private final int requested;
    private final int available;

    public InsufficientStockException(String message) {
        super(message);
        this.productReference = "UNKNOWN";
        this.requested = 0;
        this.available = 0;
    }

    public InsufficientStockException(String productReference, int requested, int available) {
        super(String.format("Insufficient stock for product '%s'. Requested: %d, Available: %d", 
                productReference, requested, available));
        this.productReference = productReference;
        this.requested = requested;
        this.available = available;
    }

    public String getProductReference() {
        return productReference;
    }

    public int getRequested() {
        return requested;
    }

    public int getAvailable() {
        return available;
    }
}
