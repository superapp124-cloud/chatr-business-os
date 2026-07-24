package com.chatr.app.views

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View

class SlideToAnswerView @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null, defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private val backgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#1A2035")
        style = Paint.Style.FILL
    }

    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#3B4256")
        style = Paint.Style.STROKE
        strokeWidth = 4f * context.resources.displayMetrics.density
    }

    private val thumbPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        style = Paint.Style.FILL
    }

    private val thumbStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#2F65F6")
        style = Paint.Style.STROKE
        strokeWidth = 6f * context.resources.displayMetrics.density
    }

    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#A0AEC0")
        textSize = 16f * context.resources.displayMetrics.scaledDensity
        textAlign = Paint.Align.CENTER
    }

    private var thumbX = 0f
    private var thumbRadius = 0f
    private val padding = 12f * context.resources.displayMetrics.density
    private var isDragging = false
    private var isAnswered = false

    private val bgRect = RectF()

    var onAnswerListener: (() -> Unit)? = null

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        bgRect.set(0f, 0f, w.toFloat(), h.toFloat())
        thumbRadius = (h - padding * 2) / 2f
        if (!isDragging && !isAnswered) {
            thumbX = padding + thumbRadius
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val cornerRadius = height / 2f
        canvas.drawRoundRect(bgRect, cornerRadius, cornerRadius, backgroundPaint)
        canvas.drawRoundRect(bgRect, cornerRadius, cornerRadius, strokePaint)

        val textY = (height / 2f) - ((textPaint.descent() + textPaint.ascent()) / 2f)
        canvas.drawText("Slide to answer", width / 2f, textY, textPaint)

        val thumbCenterY = height / 2f
        canvas.drawCircle(thumbX, thumbCenterY, thumbRadius, thumbPaint)
        canvas.drawCircle(thumbX, thumbCenterY, thumbRadius, thumbStrokePaint)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (isAnswered) return false

        when (event.action) {
            MotionEvent.ACTION_DOWN -> {
                val dx = event.x - thumbX
                val dy = event.y - (height / 2f)
                if (dx * dx + dy * dy <= thumbRadius * thumbRadius * 2) {
                    isDragging = true
                    return true
                }
            }
            MotionEvent.ACTION_MOVE -> {
                if (isDragging) {
                    thumbX = event.x.coerceIn(padding + thumbRadius, width - padding - thumbRadius)
                    invalidate()
                    
                    if (thumbX >= width - padding - thumbRadius - 10f) {
                        isAnswered = true
                        isDragging = false
                        onAnswerListener?.invoke()
                    }
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                if (isDragging && !isAnswered) {
                    isDragging = false
                    val animator = ValueAnimator.ofFloat(thumbX, padding + thumbRadius)
                    animator.duration = 200
                    animator.addUpdateListener {
                        thumbX = it.animatedValue as Float
                        invalidate()
                    }
                    animator.start()
                }
            }
        }
        return super.onTouchEvent(event)
    }
}
