import torch


def get_gradient_stats(model):
    stats = {}

    for name, parameter in model.named_parameters():
        if parameter.grad is None:
            continue

        gradient = parameter.grad.detach()

        stats[name] = {
            "mean_abs": gradient.abs().mean().item(),
            "max_abs": gradient.abs().max().item(),
            "grad_norm": gradient.norm().item(),
            "weight_norm": parameter.detach().norm().item(),
        }

    return stats


def train_one_epoch(
    model,
    loader,
    optimizer,
    loss_fn,
    log_every=100,
    track_gradients=False,
):
    model.train()

    total_loss = 0.0
    total_absolute_error = 0.0
    total_samples = 0

    gradient_history = []

    for step, (X, y) in enumerate(loader):
        optimizer.zero_grad()

        predictions = model(X)
        loss = loss_fn(predictions, y)

        loss.backward()

        if track_gradients and (step + 1) % log_every == 0:
            gradient_history.append({
                "step": step + 1,
                "layers": get_gradient_stats(model),
            })

        optimizer.step()

        batch_size = X.size(0)

        total_loss += loss.item() * batch_size
        total_absolute_error += (
            (predictions.detach() - y).abs().sum().item()
        )
        total_samples += batch_size

    result = {
        "mse": total_loss / total_samples,
        "mae_cp": total_absolute_error / total_samples * 100,
    }

    if track_gradients:
        result["gradients"] = gradient_history

    return result


@torch.no_grad()
def validate(model, loader, loss_fn):
    model.eval()

    total_loss = 0.0
    total_absolute_error = 0.0
    total_samples = 0

    for X, y in loader:
        predictions = model(X)
        loss = loss_fn(predictions, y)

        batch_size = X.size(0)

        total_loss += loss.item() * batch_size
        total_absolute_error += (
            (predictions - y).abs().sum().item()
        )
        total_samples += batch_size

    return {
        "mse": total_loss / total_samples,
        "mae_cp": total_absolute_error / total_samples * 100,
    }