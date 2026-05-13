#!/usr/bin/env python3
import json
import sys
from pathlib import Path

import cv2
import numpy as np


def load_gray(path):
    image = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise RuntimeError(f"failed to read image: {path}")

    if image.ndim == 2:
        return image

    if image.shape[2] == 4:
        alpha = image[:, :, 3]
        bgr = image[:, :, :3]
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        gray = cv2.bitwise_and(gray, gray, mask=alpha)
        return gray

    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def track_pair(prev_gray, next_gray, point):
    prev_points = np.array([[point]], dtype=np.float32)
    next_points, status, _ = cv2.calcOpticalFlowPyrLK(
        prev_gray,
        next_gray,
        prev_points,
        None,
        winSize=(31, 31),
        maxLevel=4,
        criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01),
    )

    if status is None or int(status[0][0]) != 1:
        return None

    x, y = next_points[0][0]
    return [float(x), float(y)]


def main():
    payload = json.loads(sys.stdin.read())
    frame_paths = [Path(path) for path in payload["frames"]]
    start_index = int(payload["startIndex"])
    start_point = [float(payload["point"]["x"]), float(payload["point"]["y"])]

    grays = [load_gray(path) for path in frame_paths]
    points = [None for _ in grays]
    points[start_index] = start_point

    current = start_point
    for index in range(start_index, len(grays) - 1):
        tracked = track_pair(grays[index], grays[index + 1], current)
        if tracked is None:
            break
        points[index + 1] = tracked
        current = tracked

    current = start_point
    for index in range(start_index, 0, -1):
        tracked = track_pair(grays[index], grays[index - 1], current)
        if tracked is None:
            break
        points[index - 1] = tracked
        current = tracked

    print(json.dumps({"points": points}))


if __name__ == "__main__":
    main()
